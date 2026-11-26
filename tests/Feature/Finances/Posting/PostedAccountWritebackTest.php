<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Asset\Accounting\AssetValueAdjustmentPostedAccountRecorder;
use App\Services\Finances\Accounting\PaymentEntryPostedAccountRecorder;
use App\Services\Finances\PaymentEntryService;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNote;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use App\Services\Finances\Posting\PostedAccountRecorderRegistry;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Finances\Posting\PostingService;
use App\Services\Inventory\Accounting\StockEntryPostedAccountRecorder;
use App\Services\Inventory\Accounting\StockEntryPostingContextFactory;
use App\Services\Inventory\StockEntryService;
use Carbon\CarbonImmutable;
use Database\Seeders\PrintTemplates\Finances\FinancesTemplates;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 (Requirement 13.2) untuk Payment Entry, Stock Entry (termasuk Additional Cost), dan
 * Asset Value Adjustment: akun yang dipakai engine ditulis balik senyap ke dokumen sumber di transaksi yang sama dengan
 * jurnal (jalur approve penuh untuk Payment/Stock; recorder langsung untuk kasus akun beragam dan batas dokumen).
 */
class PostedAccountWritebackTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, PaymentSchedule::class, PaymentEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);
    }

    protected function seedReceipt(string $code = 'SE-WB-1'): StockEntry {
        $inventory = $this->makeInventoryFixture($code);
        $entry     = StockEntry::create([
            'code'      => $code,
            'date'      => now()->subDays(4),
            'type'      => 'item_receipt',
            'status'    => [FormStatus::DRAFT],
            'branch_id' => $this->branch->id,
        ]);
        $entry->items()->create([
            'item_id'             => $inventory['variant']->id,
            'item_unit_id'        => $inventory['itemUnit']->id,
            'conversion_factor'   => 1,
            'quantity'            => 5,
            'basic_rate'          => 2000,
            'target_warehouse_id' => $inventory['warehouse']->id,
        ]);
        $entry->additionalCosts()->create(['purpose' => 'Angkut', 'amount' => 300]);

        return $entry->fresh();
    }

    public function test_posting_service_is_wired_with_the_recorder_registry_by_the_container(): void {
        $property = new \ReflectionProperty(PostingService::class, 'recorders');

        $this->assertInstanceOf(PostedAccountRecorderRegistry::class, $property->getValue(app(PostingService::class)), 'Container Laravel mengisi param class ber-default null dengan default-nya kecuali ada binding eksplisit.');
    }

    public function test_payment_entry_receive_and_pay_write_back_the_accounts_used_by_the_engine(): void {
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $payable    = $this->makeAccount('2010', 'Utang Profil', 'liability', 'credit');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile(['receivable' => $receivable, 'payable' => $payable]);
        $extra = ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null];

        $receive = $this->makePaymentEntry($this->makeUnpaidSalesInvoice(1_000_000), 400_000, $methodCash, $methodCash, $extra);
        app(PaymentEntryService::class)->onApproved($receive->fresh());

        $this->assertSame($methodCash->id, $receive->fresh()->account_paid_to_id, 'receive: ke = kas/bank');
        $this->assertSame($receivable->id, $receive->fresh()->account_paid_from_id, 'receive: dari = piutang');

        $pay = $this->makePaymentEntry($this->makeUnpaidPurchaseInvoice(500_000), 200_000, $methodCash, $methodCash, $extra);
        app(PaymentEntryService::class)->onApproved($pay->fresh());

        $this->assertSame($methodCash->id, $pay->fresh()->account_paid_from_id, 'pay: dari = kas/bank');
        $this->assertSame($payable->id, $pay->fresh()->account_paid_to_id, 'pay: ke = utang');

        // Cetak standar memakai relasi ini: kini terisi (Dibayar Dari/Ke) alih-alih kosong.
        $this->assertSame('Utang Profil', $pay->fresh()->accountPaidTo->account_name);
        $this->assertSame('Kas Metode Bayar', $pay->fresh()->accountPaidFrom->account_name);
        $template = collect(FinancesTemplates::definitions())->firstWhere('model', PaymentEntry::class);
        $this->assertStringContainsString('doc.account_paid_from.account_name', $template['html']);
        $this->assertStringContainsString('doc.account_paid_to.account_name', $template['html']);
    }

    public function test_payment_entry_write_back_is_silent_without_model_events(): void {
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $receive    = $this->makePaymentEntry($this->makeUnpaidSalesInvoice(1_000_000), 400_000, $methodCash, $methodCash, ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null]);

        $updated = 0;
        PaymentEntry::updated(function () use (&$updated): void {
            $updated++;
        });

        $ctx = new PostingContext(PostingDocumentType::PaymentEntry, PaymentEntry::class, (string) $receive->id, CarbonImmutable::now(), null, ['paid_amount' => 1.0], ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']);
        (new PaymentEntryPostedAccountRecorder)->record($ctx, new PostedAccountNotes([
            new PostedAccountNote('default', 'cash_or_bank', $methodCash->id),
            new PostedAccountNote('default', 'receivable', $receivable->id),
        ]));

        $this->assertSame(0, $updated, 'Write-back tidak memicu event model.');
        $this->assertSame($methodCash->id, $receive->fresh()->account_paid_to_id);
        $this->assertSame($receivable->id, $receive->fresh()->account_paid_from_id);
    }

    public function test_payment_entry_counterpart_follows_paymentable_kind_not_payment_type(): void {
        // Refund retur penjualan (T-3): arah `pay` tetapi dokumen yang dibayar Sales Invoice, sehingga lawan = piutang
        // (sama seperti PaymentEntryRule), bukan utang.
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $payment    = $this->makePaymentEntry($this->makeUnpaidSalesInvoice(1_000_000), 400_000, $methodCash, $methodCash, ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null]);

        $ctx = new PostingContext(PostingDocumentType::PaymentEntry, PaymentEntry::class, (string) $payment->id, CarbonImmutable::now(), null, ['paid_amount' => 1.0], ['payment_type' => 'pay', 'paymentable_kind' => 'sales_invoice']);
        (new PaymentEntryPostedAccountRecorder)->record($ctx, new PostedAccountNotes([
            new PostedAccountNote('default', 'cash_or_bank', $methodCash->id),
            new PostedAccountNote('default', 'receivable', $receivable->id),
        ]));

        $this->assertSame($methodCash->id, $payment->fresh()->account_paid_from_id);
        $this->assertSame($receivable->id, $payment->fresh()->account_paid_to_id);
    }

    public function test_stock_entry_approval_writes_back_difference_item_and_additional_cost_accounts(): void {
        $stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $freight    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $this->activateParityProfile(['stock' => $stock, 'stock_adjustment' => $difference, 'expense_included_in_valuation' => $freight]);
        $entry = $this->seedReceipt();

        app(StockEntryService::class)->onApproved($entry);

        $this->assertSame($difference->id, $entry->fresh()->difference_account_id);
        $this->assertSame($difference->id, $entry->items()->firstOrFail()->posted_account_id);
        $this->assertSame($freight->id, $entry->additionalCosts()->firstOrFail()->expense_account_id);
    }

    public function test_stock_entry_with_diverse_line_accounts_leaves_header_null_and_fills_each_line(): void {
        $accountA = $this->makeAccount('5900', 'Selisih A', 'expense', 'debit', 'stock_adjustment');
        $accountB = $this->makeAccount('5910', 'Selisih B', 'expense', 'debit', 'stock_adjustment');
        $entry    = $this->seedReceipt();
        $first    = $entry->items()->firstOrFail();
        $second   = $entry->items()->create([
            'item_id'             => $first->item_id,
            'item_unit_id'        => $first->item_unit_id,
            'conversion_factor'   => 1,
            'quantity'            => 1,
            'basic_rate'          => 100,
            'target_warehouse_id' => $first->target_warehouse_id,
        ]);
        DB::table('stock_entries')->where('id', $entry->id)->update(['difference_account_id' => $accountA->id]);

        $ctx = new PostingContext(PostingDocumentType::StockEntry, StockEntry::class, (string) $entry->id, CarbonImmutable::now(), null, ['basic_total' => 1.0], [], [], [new LineAttributes(lineId: (string) $first->id), new LineAttributes(lineId: (string) $second->id)]);
        (new StockEntryPostedAccountRecorder)->record($ctx, new PostedAccountNotes([
            new PostedAccountNote('default', 'stock_adjustment', $accountA->id, (string) $first->id),
            new PostedAccountNote('default', 'stock_adjustment', $accountB->id, (string) $second->id),
        ]));

        $this->assertNull($entry->fresh()->difference_account_id, 'Akun beragam: kolom header null (keputusan 25 Nov 2026).');
        $this->assertSame($accountA->id, $first->fresh()->posted_account_id);
        $this->assertSame($accountB->id, $second->fresh()->posted_account_id);
    }

    public function test_stock_entry_recorder_only_touches_its_own_document_and_its_own_additional_costs(): void {
        $account = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $entry   = $this->seedReceipt('SE-WB-A');
        $other   = $this->seedReceipt('SE-WB-B');
        $cost    = $entry->additionalCosts()->firstOrFail();
        $foreign = $other->additionalCosts()->firstOrFail();

        $ctx = new PostingContext(PostingDocumentType::StockEntry, StockEntry::class, (string) $entry->id, CarbonImmutable::now(), null, ['basic_total' => 1.0]);
        (new StockEntryPostedAccountRecorder)->record($ctx, new PostedAccountNotes([
            new PostedAccountNote('additional_cost:' . $cost->id, 'expense_included_in_valuation', $account->id),
            new PostedAccountNote('additional_cost:' . $foreign->id, 'expense_included_in_valuation', $account->id),
        ]));

        $this->assertSame($account->id, $cost->fresh()->expense_account_id);
        $this->assertNull($foreign->fresh()->expense_account_id, 'Biaya milik Stock Entry lain tidak tersentuh.');
        $this->assertNull($entry->fresh()->difference_account_id, 'Tanpa catatan stock_adjustment, header tidak diubah.');
    }

    public function test_asset_value_adjustment_recorder_writes_the_asset_revaluation_account_only(): void {
        $account = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit');
        $ctx     = new PostingContext(PostingDocumentType::AssetValueAdjustment, 'asset_value_adjustment', (string) Str::ulid(), CarbonImmutable::now(), null, ['difference_amount' => 10.0]);

        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = $query->sql;
        });
        $updates = function () use (&$queries): array {
            return array_values(array_filter($queries, fn (string $sql): bool => str_starts_with($sql, 'update')));
        };

        (new AssetValueAdjustmentPostedAccountRecorder)->record($ctx, new PostedAccountNotes([new PostedAccountNote('value_adjustment', 'fixed_asset', $account->id)]));
        $this->assertSame([], $updates(), 'Tanpa catatan asset_revaluation tidak ada tulis.');

        (new AssetValueAdjustmentPostedAccountRecorder)->record($ctx, new PostedAccountNotes([new PostedAccountNote('value_adjustment', 'asset_revaluation', $account->id)]));
        $this->assertCount(1, $updates());
        $this->assertStringContainsString('"asset_value_adjustments"', $updates()[0]);
        $this->assertStringContainsString('"id" = ?', $updates()[0]);
    }

    public function test_retry_after_posting_does_not_overwrite_the_recorded_accounts(): void {
        $stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $freight    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $sentinel   = $this->makeAccount('5999', 'Penanda', 'expense', 'debit');
        $this->activateParityProfile(['stock' => $stock, 'stock_adjustment' => $difference, 'expense_included_in_valuation' => $freight]);
        $entry = $this->seedReceipt();
        app(StockEntryService::class)->onApproved($entry);

        DB::table('stock_entries')->where('id', $entry->id)->update(['difference_account_id' => $sentinel->id]);

        $ctx = app(StockEntryPostingContextFactory::class)->forApproval($entry->fresh(), $entry->items()->get(), $entry->additionalCosts()->get(), 10_000.0, now());
        $this->assertTrue(app(PostingGateway::class)->post($ctx)->isAlreadyPosted());

        $this->assertSame($sentinel->id, $entry->fresh()->difference_account_id, 'already_posted tidak memanggil recorder.');
    }

    public function test_recorder_failure_rolls_back_the_journals_with_the_approval(): void {
        $stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $freight    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $this->activateParityProfile(['stock' => $stock, 'stock_adjustment' => $difference, 'expense_included_in_valuation' => $freight]);
        $entry = $this->seedReceipt();

        $this->app->instance(PostedAccountRecorderRegistry::class, new PostedAccountRecorderRegistry($this->app, [PostingDocumentType::StockEntry->value => ThrowingStockEntryRecorder::class]));
        $this->app->forgetInstance(PostingGateway::class);

        try {
            app(StockEntryService::class)->onApproved($entry);
            $this->fail('Recorder yang gagal harus menggulung approve.');
        } catch (RuntimeException $e) {
            $this->assertSame('recorder gagal', $e->getMessage());
        }

        $this->assertSame(0, Journal::query()->where('source_id', $entry->id)->count(), 'Jurnal ikut digulung.');
        $this->assertSame(0, StockLedgerEntry::count());
        $this->assertNull($entry->fresh()->difference_account_id);
    }
}

/**
 * Recorder uji yang selalu gagal, untuk memeriksa atomisitas dengan jurnal.
 */
final class ThrowingStockEntryRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::StockEntry;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        throw new RuntimeException('recorder gagal');
    }
}
