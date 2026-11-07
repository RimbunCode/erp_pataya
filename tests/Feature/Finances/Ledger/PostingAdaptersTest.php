<?php

namespace Tests\Feature\Finances\Ledger;

use App\Enums\FormStatus;
use App\Enums\JournalStatus;
use App\Events\Asset\AssetScrapped;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Exceptions\Finances\InvalidJournalException;
use App\Listeners\Asset\Depreciation\PostScrapWriteOff;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\PaymentEntryService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Inventory\StockEntryService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 6 (Requirement 3, 8): adapter titik posting memakai `JournalService`: jurnal bersumber dokumen
 * dengan `posting_key`, retry idempoten (`DuplicatePostingException` = sudah terposting), pasangan nol tidak
 * membuat jurnal (Requirement 2.10), `purpose` per pasangan, dan tanda `voided` oleh hook cancel `Submitable`
 * (Requirement 8.6). Kesamaan baris dengan perilaku lama dijaga test characterization Fase 0.
 */
class PostingAdaptersTest extends TestCase {
    use BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $sales;
    private Account $cash;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PurchaseInvoice::class, PaymentSchedule::class, PaymentEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->sales      = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
    }

    private function journalsOf(object $document): Collection {
        return Journal::query()->where('source_type', $document::class)->where('source_id', $document->getKey())->orderBy('posting_key')->get();
    }

    private function salesEvent(SalesInvoice $invoice, float $amount, bool $isReturn = false): SalesInvoiceGeneralLedgerPostingRequested {
        return new SalesInvoiceGeneralLedgerPostingRequested($invoice, $amount, $isReturn, now(), $this->receivable->id, $this->sales->id);
    }

    public function test_sales_invoice_posting_creates_a_keyed_journal_with_numbered_lines(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);

        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($invoice, 500));

        $journal = $this->journalsOf($invoice)->sole();
        $this->assertSame("{$invoice->getMorphClass()}:{$invoice->id}:default", $journal->posting_key);
        $this->assertSame('posted', $journal->status);
        $this->assertFalse($journal->legacy_origin);

        $lines = $journal->lines;
        $this->assertSame([1, 2], $lines->pluck('line_no')->all());
        $this->assertSame([$this->receivable->id, $this->sales->id], $lines->pluck('account_id')->all());
        $this->assertSame([500.0, 0.0], $lines->pluck('debit')->all());
        $this->assertTrue($lines->every(fn (GeneralLedger $line) => $line->referenceable_id === $invoice->id));
    }

    public function test_return_swaps_the_sides_of_the_pair(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);

        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($invoice, 500, isReturn: true));

        $lines = $this->journalsOf($invoice)->sole()->lines;
        $this->assertSame([$this->sales->id, $this->receivable->id], $lines->pluck('account_id')->all());
        $this->assertSame([500.0, 0.0], $lines->pluck('debit')->all());
    }

    public function test_retry_of_an_already_posted_invoice_is_treated_as_posted_without_duplicating_rows(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);
        GlPostingStatus::create(['referenceable_type' => $invoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::FAILED->value]);

        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($invoice, 500));
        GlPostingStatus::where('referenceable_id', $invoice->id)->update(['status' => FormStatus::FAILED->value]);
        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($invoice, 500));

        $this->assertCount(1, $this->journalsOf($invoice));
        $this->assertSame(2, GeneralLedger::where('referenceable_id', $invoice->id)->count());
        $this->assertSame(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $invoice->id)->first()->status, 'Retry menandai posted tanpa mengulang posting (Requirement 3.3).');
    }

    public function test_zero_amount_posts_no_journal_and_no_zero_rows(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);
        GlPostingStatus::create(['referenceable_type' => $invoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING->value]);

        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($invoice, 0));

        $this->assertCount(0, $this->journalsOf($invoice));
        $this->assertSame(0, GeneralLedger::withTrashed()->count(), 'Requirement 2.10 (N-8): tidak ada baris 0/0.');
        $this->assertSame(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $invoice->id)->first()->status, 'Status posting tetap diperbarui.');
    }

    public function test_purchase_invoice_posts_two_separate_journals_for_stock_and_expense(): void {
        $expense = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $payable = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $stock   = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $invoice = PurchaseInvoice::create([
            'date'                    => now(),
            'expanse_head_account_id' => $expense->id,
            'credit_account_id'       => $payable->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);

        $event = new PurchaseInvoiceGeneralLedgerPostingRequested($invoice, 300, 1000, false, now(), $expense->id, $payable->id);
        (new PostPurchaseInvoiceGeneralLedger)->handle($event);
        (new PostPurchaseInvoiceGeneralLedger)->handle($event);

        $journals = $this->journalsOf($invoice);
        $this->assertSame(["{$invoice->getMorphClass()}:{$invoice->id}:expense", "{$invoice->getMorphClass()}:{$invoice->id}:stock"], $journals->pluck('posting_key')->all());
        $this->assertSame(4, GeneralLedger::where('referenceable_id', $invoice->id)->count(), 'Retry tidak menggandakan baris.');
        $this->assertSame($stock->id, $journals->firstWhere('posting_key', "{$invoice->getMorphClass()}:{$invoice->id}:stock")->lines->first()->account_id);
    }

    public function test_payment_entry_posts_post_hotfix_direction_through_a_journal(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $journal = $this->journalsOf($payment)->sole();
        $this->assertSame("{$payment->getMorphClass()}:{$payment->id}:default", $journal->posting_key);
        $lines = $journal->lines;
        // Pasca-hotfix: debit account_paid_to, kredit account_paid_from, jumlah Payment Entry itu.
        $this->assertSame([$this->cash->id, $this->receivable->id], $lines->pluck('account_id')->all());
        $this->assertSame([400_000.0, 0.0], $lines->pluck('debit')->all());
        $this->assertSame([0.0, 400_000.0], $lines->pluck('credit')->all());
    }

    public function test_stock_entry_additional_costs_each_get_their_own_journal(): void {
        $stock                                                                      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference                                                                 = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $freight                                                                    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $insurance                                                                  = $this->makeAccount('5801', 'Biaya Asuransi', 'expense', 'debit');
        ['warehouse' => $warehouse, 'variant' => $variant, 'itemUnit' => $itemUnit] = $this->makeInventoryFixture();

        $entry = StockEntry::create([
            'code'                  => 'SE-JRN',
            'date'                  => now(),
            'type'                  => 'item_receipt',
            'status'                => [FormStatus::DRAFT],
            'branch_id'             => $this->branch->id,
            'difference_account_id' => $difference->id,
        ]);
        $entry->items()->create(['item_id' => $variant->id, 'item_unit_id' => $itemUnit->id, 'conversion_factor' => 1, 'quantity' => 5, 'basic_rate' => 2000, 'target_warehouse_id' => $warehouse->id]);
        $first  = $entry->additionalCosts()->create(['expense_account_id' => $freight->id, 'purpose' => 'Angkut', 'amount' => 300]);
        $second = $entry->additionalCosts()->create(['expense_account_id' => $insurance->id, 'purpose' => 'Asuransi', 'amount' => 200]);

        app(StockEntryService::class)->onApproved($entry->fresh());

        $keys = $this->journalsOf($entry)->pluck('posting_key')->all();
        sort($keys);
        $prefix   = "{$entry->getMorphClass()}:{$entry->id}";
        $expected = ["{$prefix}:additional_cost:{$first->id}", "{$prefix}:additional_cost:{$second->id}", "{$prefix}:default"];
        sort($expected);
        $this->assertSame($expected, $keys);
        $this->assertSame(6, GeneralLedger::where('referenceable_id', $entry->id)->count());
        $this->assertSame($stock->id, $this->journalsOf($entry)->firstWhere('posting_key', "{$prefix}:default")->lines->first()->account_id);
    }

    public function test_disposal_is_keyed_per_invoice_line_so_a_second_line_posts_and_the_same_line_does_not_repeat(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts();
        $first              = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => 1500]);
        $second             = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => 1600]);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($first));
        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($second));

        $prefix = "{$asset->getMorphClass()}:{$asset->id}:disposal";
        $keys   = $this->journalsOf($asset)->pluck('posting_key')->sort()->values()->all();
        $this->assertSame(collect(["{$prefix}:{$first->id}", "{$prefix}:{$second->id}"])->sort()->values()->all(), $keys, 'Tiap baris penjualan punya posting sendiri (Q-P1-6).');

        // Memproses ulang baris yang sama (processed_at direset) tidak memposting kedua kalinya.
        $first->forceFill(['processed_at' => null])->save();
        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($first->fresh()));
        $this->assertCount(2, $this->journalsOf($asset));
        $this->assertNotNull($first->fresh()->processed_at);
    }

    public function test_scrap_with_zero_write_off_posts_nothing_and_leaves_no_journal_entry_reference(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts(['is_depreciable' => true]);

        (new PostScrapWriteOff)->handle(new AssetScrapped($asset, 0.0, now()));

        $this->assertCount(0, $this->journalsOf($asset));
        $this->assertNull($asset->fresh()->journal_entry_for_scrap_id);
    }

    public function test_scrap_posts_under_the_write_off_key_and_points_to_the_credit_line(): void {
        ['asset' => $asset, 'fixed' => $fixed] = $this->makeAssetWithAccounts(['is_depreciable' => true]);

        (new PostScrapWriteOff)->handle(new AssetScrapped($asset, 1000.0, now()));

        $journal = $this->journalsOf($asset)->sole();
        $this->assertSame("{$asset->getMorphClass()}:{$asset->id}:write_off", $journal->posting_key);
        $creditLine = $journal->lines->firstWhere('account_id', $fixed->id);
        $this->assertSame($creditLine->id, $asset->fresh()->journal_entry_for_scrap_id);
        $this->assertEqualsWithDelta(1000, $creditLine->credit, 0.001);
    }

    public function test_cancel_marks_the_source_journal_voided_for_sales_invoice_payment_entry_and_stock_entry(): void {
        // Sales Invoice
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $this->assertSame('posted', $this->journalsOf($invoice->fresh())->sole()->status);
        app(SalesInvoiceService::class)->cancel($invoice->fresh());
        $this->assertSame(JournalStatus::Voided->value, $this->journalsOf($invoice)->sole()->status);
        $this->assertSame(0, GeneralLedger::where('referenceable_id', $invoice->id)->count(), 'Hook soft-delete tetap berjalan.');

        // Payment Entry
        $unpaid  = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($unpaid, 1_000_000, $this->receivable, $this->cash);
        app(PaymentEntryService::class)->onApproved($payment->fresh());
        $this->assertSame('posted', $this->journalsOf($payment)->sole()->status);
        app(PaymentEntryService::class)->cancel($payment->fresh());
        $this->assertSame('voided', $this->journalsOf($payment)->sole()->status);

        // Stock Entry
        $stock                                                                      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference                                                                 = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        ['warehouse' => $warehouse, 'variant' => $variant, 'itemUnit' => $itemUnit] = $this->makeInventoryFixture();
        $entry                                                                      = StockEntry::create(['code' => 'SE-VOID', 'date' => now(), 'type' => 'item_receipt', 'status' => [FormStatus::DRAFT], 'branch_id' => $this->branch->id, 'difference_account_id' => $difference->id]);
        $entry->items()->create(['item_id' => $variant->id, 'item_unit_id' => $itemUnit->id, 'conversion_factor' => 1, 'quantity' => 5, 'basic_rate' => 2000, 'target_warehouse_id' => $warehouse->id]);
        app(StockEntryService::class)->onApproved($entry->fresh());
        $this->assertSame('posted', $this->journalsOf($entry)->sole()->status);
        app(StockEntryService::class)->cancel($entry->fresh());
        $this->assertSame('voided', $this->journalsOf($entry)->sole()->status);
        $this->assertNotNull($stock);
    }

    public function test_cancel_voids_both_the_reversed_original_and_its_reversal_journal_but_not_other_sources(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $original = $this->journalsOf($invoice->fresh())->sole();
        $reversal = app(JournalReversalService::class)->reverse($original, now(), 'Koreksi');
        $this->assertSame(JournalStatus::Reversed->value, $original->fresh()->status);
        $this->assertSame('posted', $reversal->fresh()->status);

        $other = $this->makeSalesInvoice($this->receivable, $this->sales);
        app(SalesInvoiceService::class)->onApproved($other);

        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $this->assertSame(JournalStatus::Voided->value, $original->fresh()->status, 'Jurnal asal (reversed) ikut di-void.');
        $this->assertSame(JournalStatus::Voided->value, $reversal->fresh()->status, 'Jurnal pembalik ikut di-void.');
        $this->assertSame('posted', $this->journalsOf($other->fresh())->sole()->status, 'Sumber lain tidak tersentuh.');
    }

    public function test_parity_fractional_amounts_are_rounded_half_up_at_the_posting_boundary(): void {
        // Selisih yang diizinkan terhadap perilaku lama (D-3): nilai pecahan dibulatkan ke minor unit mata uang dasar.
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);

        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($invoice, 99.9999));

        $lines = $this->journalsOf($invoice)->sole()->lines;
        $this->assertSame([100.0, 0.0], $lines->pluck('debit')->all());
        $this->assertSame([0.0, 100.0], $lines->pluck('credit')->all());

        // Di bawah setengah minor unit: dibulatkan menjadi 0, tidak ada jurnal (Requirement 2.10).
        $tiny = $this->makeSalesInvoice($this->receivable, $this->sales);
        (new PostSalesInvoiceGeneralLedger)->handle($this->salesEvent($tiny, 0.004));
        $this->assertCount(0, $this->journalsOf($tiny));
    }

    public function test_stock_entry_approval_rolls_back_completely_when_posting_is_rejected_and_leaves_no_open_transaction(): void {
        $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference                                                                 = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        ['warehouse' => $warehouse, 'variant' => $variant, 'itemUnit' => $itemUnit] = $this->makeInventoryFixture();
        $entry                                                                      = StockEntry::create(['code' => 'SE-RB', 'date' => now(), 'type' => 'item_receipt', 'status' => [FormStatus::DRAFT], 'branch_id' => $this->branch->id, 'difference_account_id' => $difference->id]);
        $entry->items()->create(['item_id' => $variant->id, 'item_unit_id' => $itemUnit->id, 'conversion_factor' => 1, 'quantity' => 5, 'basic_rate' => 2000, 'target_warehouse_id' => $warehouse->id]);
        // Akun grup ditolak JournalService (Requirement 2.4) setelah status dan stok sudah diubah di dalam approval.
        DB::table('accounts')->where('id', $difference->id)->update(['is_group' => true]);
        $level         = DB::transactionLevel();
        $balanceBefore = DB::table('accounts')->pluck('balance_amount', 'id')->all();

        try {
            app(StockEntryService::class)->onApproved($entry->fresh());
            $this->fail('Approval harus ditolak karena akun grup.');
        } catch (InvalidJournalException) {
            $this->addToAssertionCount(1);
        }

        $this->assertSame($level, DB::transactionLevel(), 'Tidak ada transaksi menggantung.');
        $this->assertNotContains(FormStatus::COMPLETED, $entry->fresh()->status);
        $this->assertSame(0, Journal::query()->count());
        $this->assertSame(0, GeneralLedger::withTrashed()->count());
        $this->assertSame(0, StockLedgerEntry::query()->count(), 'Mutasi stok ikut tergulung.');
        $this->assertEquals($balanceBefore, DB::table('accounts')->pluck('balance_amount', 'id')->all());
    }
}
