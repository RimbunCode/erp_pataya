<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger;
use App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Inventory\StockEntryService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 8.4: parity end-to-end kelompok 2 (Purchase Receipt, Delivery Note, Sales Invoice, Purchase
 * Invoice stok dan non-stok, Stock Entry). P-1: satu dokumen per mode (`off`, `shadow`, `on`) lewat listener/service
 * sungguhan, tanda tangan jurnal, efek samping (saldo akun, `GlPostingStatus`), dan parity log `match` pada `shadow`
 * identik. Termasuk kasus retur. Profil memetakan semua peran ke akun yang sama dengan jalur lama
 * (`expense` Purchase Invoice = SRNB, T-9).
 */
class PostingParityGroup2Test extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    private Account $stock;
    private Account $srnb;
    private Account $cogs;
    private Account $receivable;
    private Account $revenue;
    private Account $payable;
    private Account $difference;
    private Account $freight;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, PurchaseReceipt::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);

        $this->stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb       = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->cogs       = $this->makeAccount('5100', 'HPP', 'income', 'debit', 'cost_of_goods_sold');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue    = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->payable    = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $this->freight    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');

        $this->activateParityProfile([
            'stock'                         => $this->stock,
            'stock_received_but_not_billed' => $this->srnb,
            'cost_of_goods_sold'            => $this->cogs,
            'receivable'                    => $this->receivable,
            'revenue'                       => $this->revenue,
            'payable'                       => $this->payable,
            'expense'                       => $this->srnb, // T-9: `expense` Purchase Invoice default ke SRNB
            'stock_adjustment'              => $this->difference,
            'expense_included_in_valuation' => $this->freight,
        ]);

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-PARITY-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    private function pending(Model $document): void {
        GlPostingStatus::create(['referenceable_type' => $document::class, 'referenceable_id' => $document->getKey(), 'status' => FormStatus::PENDING]);
    }

    private function postingStatusOf(Model $document): ?string {
        return GlPostingStatus::where('referenceable_type', $document::class)->where('referenceable_id', $document->getKey())->first()?->status->value;
    }

    private function makeReceipt(): PurchaseReceipt {
        $id = (string) Str::ulid();
        DB::table('purchase_receipts')->insert(['id' => $id, 'code' => 'PR-' . Str::upper(Str::random(8)), 'created_by_id' => $this->user->id, 'date' => now()->subDays(2), 'created_at' => now(), 'updated_at' => now()]);

        return PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($id));
    }

    private function makeDeliveryNote(): DeliveryNote {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId, 'module' => 'inventory', 'name' => 'delivery_note_parity_' . Str::random(4), 'model' => DeliveryNote::class,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $id = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $id,
            'delivery_date'      => now()->subDays(2),
            'reference_to_id'    => $permissionId,
            'referenceable_type' => 'App\\Models\\Sales\\SalesOrder',
            'referenceable_id'   => (string) Str::ulid(),
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        return DeliveryNote::withoutEvents(fn () => DeliveryNote::find($id));
    }

    public function test_purchase_receipt_and_delivery_note_are_identical_in_all_modes(): void {
        $date       = CarbonImmutable::parse('2026-11-10 09:00:00');
        $signatures = [];
        $effects    = [];

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::PurchaseReceipt, $mode);
            $this->setPostingMode(PostingDocumentType::DeliveryNote, $mode);

            $documents = [];
            foreach (['receipt' => false, 'receipt_return' => true] as $case => $isReturn) {
                $document = $this->makeReceipt();
                $this->pending($document);
                (new PostPurchaseReceiptGeneralLedger)->handle(new PurchaseReceiptGeneralLedgerPostingRequested($document, 1200.0, $isReturn, $date));
                $documents[$case] = $document;
            }
            foreach (['delivery' => false, 'delivery_return' => true] as $case => $isReturn) {
                $document = $this->makeDeliveryNote();
                $this->pending($document);
                (new PostDeliveryNoteGeneralLedger)->handle(new DeliveryNoteGeneralLedgerPostingRequested($document, 700.0, $isReturn, $date));
                $documents[$case] = $document;
            }

            foreach ($documents as $case => $document) {
                $signatures[$case][$mode] = $this->journalSignature($document);
                $effects[$mode][$case]    = $this->postingStatusOf($document);
                $this->assertSame($mode === 'shadow' ? 'match' : null, $this->parityLogStatus($document), "{$case} / {$mode}");
            }

            // Dokumen dibatalkan sebelum job berjalan: dilewati pada semua mode, `skipped` tidak ditimpa `posted`.
            $canceled = $this->makeReceipt();
            $this->pending($canceled);
            PurchaseReceipt::withoutEvents(fn () => $canceled->update(['status' => [FormStatus::CANCELED]]));
            (new PostPurchaseReceiptGeneralLedger)->handle(new PurchaseReceiptGeneralLedgerPostingRequested($canceled->fresh(), 1200.0, false, $date));
            $signatures['canceled'][$mode] = $this->journalSignature($canceled);
            $effects[$mode]['canceled']    = $this->postingStatusOf($canceled);
        }

        foreach (['receipt', 'receipt_return', 'delivery', 'delivery_return'] as $case) {
            $this->assertSignaturesIdentical($case, $signatures[$case]);
        }
        $this->assertSignaturesIdentical('canceled', $signatures['canceled'], allowEmpty: true);
        $this->assertSame([], $signatures['canceled']['on']);
        $this->assertEquals($effects['off'], $effects['shadow']);
        $this->assertEquals($effects['off'], $effects['on']);
        $this->assertSame('skipped', $effects['on']['canceled']);
        $this->assertSame('posted', $effects['on']['receipt']);

        $this->assertEquals(['default' => ['date' => '2026-11-10', 'lines' => [['1300', 1200.0, 0.0], ['2100', 0.0, 1200.0]]]], $signatures['receipt']['on']);
        $this->assertEquals([['2100', 1200.0, 0.0], ['1300', 0.0, 1200.0]], $signatures['receipt_return']['on']['default']['lines']);
        $this->assertEquals([['5100', 700.0, 0.0], ['1300', 0.0, 700.0]], $signatures['delivery']['on']['default']['lines']);
        $this->assertEquals([['1300', 700.0, 0.0], ['5100', 0.0, 700.0]], $signatures['delivery_return']['on']['default']['lines']);
    }

    public function test_sales_invoice_normal_and_return_are_identical_in_all_modes(): void {
        $signatures = [];
        $effects    = [];

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::SalesInvoice, $mode);

            $original     = $this->makeSalesInvoice($this->receivable, $this->revenue);
            $original     = $this->approveSalesInvoice($original);
            $originalItem = $original->items()->first();
            $return       = $this->makeSalesInvoice(
                $this->receivable,
                $this->revenue,
                ['return_against_id' => $original->id],
                ['quantity' => 1, 'return_against_item_id' => $originalItem->id],
            );
            $return = $this->approveSalesInvoice($return);

            $signatures['normal'][$mode] = $this->journalSignature($original);
            $signatures['return'][$mode] = $this->journalSignature($return);
            $effects[$mode]              = [$this->postingStatusOf($original), $this->postingStatusOf($return), (float) $original->amount, (float) $return->amount];

            $this->assertSame($mode === 'shadow' ? 'match' : null, $this->parityLogStatus($original), "normal / {$mode}");
            $this->assertSame($mode === 'shadow' ? 'match' : null, $this->parityLogStatus($return), "return / {$mode}");
        }

        $this->assertSignaturesIdentical('normal', $signatures['normal']);
        $this->assertSignaturesIdentical('return', $signatures['return']);
        $this->assertEquals($effects['off'], $effects['shadow']);
        $this->assertEquals($effects['off'], $effects['on']);

        $this->assertEquals([['1200', 2183.33, 0.0], ['4000', 0.0, 2183.33]], $signatures['normal']['on']['default']['lines']);
        $this->assertEquals([['4000', 1091.67, 0.0], ['1200', 0.0, 1091.67]], $signatures['return']['on']['default']['lines']);
    }

    private function approveSalesInvoice(SalesInvoice $invoice): SalesInvoice {
        app(SalesInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $itemAttributes
     */
    private function makePurchaseInvoice(array $attributes = [], array $itemAttributes = []): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'                    => now()->subDays(3),
            'expanse_head_account_id' => $this->srnb->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $this->purchaseOrder->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
            ...$attributes,
        ]);

        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create()->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'tax_rate'            => 10,
            ...$itemAttributes,
        ]);

        return $invoice->fresh();
    }

    public function test_purchase_invoice_non_stock_stock_and_return_are_identical_in_all_modes(): void {
        $signatures = [];
        $effects    = [];

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::PurchaseInvoice, $mode);

            // Non-stok: satu jurnal `expense` (jalur service penuh, baris invoice menjadi `lines` konteks).
            $normal = $this->makePurchaseInvoice();
            app(PurchaseInvoiceService::class)->onApproved($normal);
            $normal       = $normal->fresh();
            $originalItem = $normal->items()->first();

            // Retur lewat service penuh.
            $return = $this->makePurchaseInvoice(['return_against_id' => $normal->id], ['quantity' => 1, 'return_against_item_id' => $originalItem->id]);
            app(PurchaseInvoiceService::class)->onApproved($return);
            $return = $return->fresh();

            // Cabang stok (dua jurnal `stock` + `expense`) dan retur dengan stok (jurnal stok dilewati), via event + listener.
            $stockInvoice  = $this->makePurchaseInvoice();
            $returnedStock = $this->makePurchaseInvoice();
            foreach ([[$stockInvoice, 1500.0, 2183.33, false], [$returnedStock, 500.0, 800.0, true]] as [$invoice, $stockTotal, $total, $isReturn]) {
                $this->pending($invoice);
                (new PostPurchaseInvoiceGeneralLedger)->handle(new PurchaseInvoiceGeneralLedgerPostingRequested(
                    $invoice,
                    $stockTotal,
                    $total,
                    $isReturn,
                    now(),
                    $this->srnb->id,
                    $this->payable->id,
                ));
            }

            foreach (['normal' => $normal, 'return' => $return, 'stock' => $stockInvoice, 'stock_return' => $returnedStock] as $case => $document) {
                $signatures[$case][$mode] = $this->journalSignature($document);
                $effects[$mode][$case]    = $this->postingStatusOf($document);
                $this->assertSame($mode === 'shadow' ? 'match' : null, $this->parityLogStatus($document), "{$case} / {$mode}");
            }
        }

        foreach (['normal', 'return', 'stock', 'stock_return'] as $case) {
            $this->assertSignaturesIdentical($case, $signatures[$case]);
        }
        $this->assertEquals($effects['off'], $effects['shadow']);
        $this->assertEquals($effects['off'], $effects['on']);

        $this->assertSame(['expense'], array_keys($signatures['normal']['on']));
        $this->assertEquals([['2100', 2183.33, 0.0], ['2000', 0.0, 2183.33]], $signatures['normal']['on']['expense']['lines']);
        $this->assertEquals([['2000', 1091.67, 0.0], ['2100', 0.0, 1091.67]], $signatures['return']['on']['expense']['lines']);
        $this->assertSame(['expense', 'stock'], array_keys($signatures['stock']['on']), 'Purchase Invoice stok menghasilkan dua jurnal.');
        $this->assertEquals([['1300', 1500.0, 0.0], ['2100', 0.0, 1500.0]], $signatures['stock']['on']['stock']['lines']);
        $this->assertSame(['expense'], array_keys($signatures['stock_return']['on']), 'Retur melewati jurnal stok.');
    }

    private function approveStockEntry(StockEntry $entry): StockEntry {
        app(StockEntryService::class)->onApproved($entry);

        return $entry->fresh();
    }

    /**
     * @param  array<string, mixed>  $itemAttributes
     * @param  list<float>  $costs
     */
    private function makeStockEntry2(string $type, array $itemAttributes, array $costs, array $inventory): StockEntry {
        $entry = StockEntry::create([
            'code'                  => 'SE-' . Str::upper(Str::random(6)),
            'date'                  => now()->subDays(4),
            'type'                  => $type,
            'status'                => [FormStatus::DRAFT],
            'branch_id'             => $this->branch->id,
            'difference_account_id' => $this->difference->id,
        ]);
        $entry->items()->create([
            'item_id'           => $inventory['variant']->id,
            'item_unit_id'      => $inventory['itemUnit']->id,
            'conversion_factor' => 1,
            'quantity'          => 5,
            'basic_rate'        => 2000,
            ...$itemAttributes,
        ]);
        foreach ($costs as $amount) {
            $entry->additionalCosts()->create(['expense_account_id' => $this->freight->id, 'purpose' => 'Angkut', 'amount' => $amount]);
        }

        return $entry->fresh();
    }

    /**
     * Purpose `additional_cost:{id}` memuat ID biaya yang berbeda per dokumen/mode: dinormalkan menjadi `additional_cost`.
     *
     * @param  array<string, mixed>  $signature
     * @return array<string, mixed>
     */
    private function withoutCostIds(array $signature): array {
        $result = [];
        foreach ($signature as $purpose => $journal) {
            $result[str_starts_with($purpose, 'additional_cost:') ? 'additional_cost' : $purpose] = $journal;
        }
        ksort($result);

        return $result;
    }

    private function balances(): array {
        return Account::query()->orderBy('account_number')->get()->mapWithKeys(fn (Account $account): array => [$account->account_number => round((float) $account->balance_amount, 4)])->all();
    }

    public function test_stock_entry_is_identical_in_all_modes_including_balances_and_additional_costs(): void {
        $inventory  = $this->makeInventoryFixture();
        $target     = Warehouse::create(['branch_id' => $this->branch->id, 'name' => 'Gudang Tujuan', 'code' => 'WH-TGT']);
        $signatures = [];
        $deltas     = [];

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::StockEntry, $mode);
            $before = $this->balances();

            $receipt  = $this->approveStockEntry($this->makeStockEntry2('item_receipt', ['target_warehouse_id' => $inventory['warehouse']->id], [300.0], $inventory));
            $issue    = $this->approveStockEntry($this->makeStockEntry2('item_issue', ['source_warehouse_id' => $inventory['warehouse']->id, 'quantity' => 2], [], $inventory));
            $transfer = $this->approveStockEntry($this->makeStockEntry2('item_transfer', ['source_warehouse_id' => $inventory['warehouse']->id, 'target_warehouse_id' => $target->id, 'quantity' => 1], [120.0], $inventory));

            $signatures['receipt'][$mode]  = $this->withoutCostIds($this->journalSignature($receipt));
            $signatures['issue'][$mode]    = $this->withoutCostIds($this->journalSignature($issue));
            $signatures['transfer'][$mode] = $this->withoutCostIds($this->journalSignature($transfer));

            $after         = $this->balances();
            $deltas[$mode] = array_map(fn (string $number): float => round($after[$number] - $before[$number], 4), array_combine(array_keys($after), array_keys($after)));
            $this->assertSame(0, GlPostingStatus::where('referenceable_type', StockEntry::class)->count(), 'Stock Entry tidak dilacak GlPostingStatus.');

            foreach ([$receipt, $issue, $transfer] as $document) {
                $this->assertSame($mode === 'shadow' ? 'match' : null, $this->parityLogStatus($document), "{$document->type} / {$mode}");
            }
        }

        foreach (['receipt', 'issue', 'transfer'] as $case) {
            $this->assertSignaturesIdentical($case, $signatures[$case]);
        }
        // `balance_amount` (F-09) identik: engine tidak memutasinya, service yang memutasi dari akun yang sama.
        $this->assertEquals($deltas['off'], $deltas['shadow']);
        $this->assertEquals($deltas['off'], $deltas['on']);
        $this->assertEqualsWithDelta(10_000 + 300 - 4_000 + 120, $deltas['on']['1300'], 0.01);
        $this->assertEqualsWithDelta(-10_000 + 4_000, $deltas['on']['5900'], 0.01);
        $this->assertEqualsWithDelta(-300 - 120, $deltas['on']['5800'], 0.01);

        $this->assertSame(['additional_cost', 'default'], array_keys($signatures['receipt']['on']));
        $this->assertEquals([['1300', 300.0, 0.0], ['5800', 0.0, 300.0]], $signatures['receipt']['on']['additional_cost']['lines']);
        $this->assertSame(['additional_cost'], array_keys($signatures['transfer']['on']), 'Transfer: hanya jurnal biaya tambahan (T-5/T-6).');
        $this->assertEquals([['5900', 4000.0, 0.0], ['1300', 0.0, 4000.0]], $signatures['issue']['on']['default']['lines']);
    }

    /**
     * Pengecualian parity yang disetujui (Q-P2-20, Req 7.5): Stock Entry bertotal 0 tidak menghasilkan jurnal; jalur lama
     * tetap menyetel `have_transactions` pada akun stok dan akun selisih, sedangkan pada `on` (tanpa jurnal) tidak.
     */
    public function test_stock_entry_with_zero_total_does_not_set_have_transactions_on_in_on_mode(): void {
        $inventory = $this->makeInventoryFixture();
        $flags     = [];

        foreach (['off', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::StockEntry, $mode);
            Account::query()->update(['have_transactions' => false]);

            $entry = $this->approveStockEntry($this->makeStockEntry2('item_receipt', ['target_warehouse_id' => $inventory['warehouse']->id, 'basic_rate' => 0], [], $inventory));

            $this->assertSame([], $this->journalSignature($entry), "{$mode}: total 0 tidak membuat jurnal.");
            $flags[$mode] = [(bool) $this->stock->fresh()->have_transactions, (bool) $this->difference->fresh()->have_transactions];
        }

        $this->assertSame([true, true], $flags['off'], 'Jalur lama menyetel have_transactions walau total 0.');
        $this->assertSame([false, false], $flags['on'], 'on: tanpa jurnal, have_transactions tidak disetel (pengecualian parity Q-P2-20).');
    }

    public function test_stock_entry_on_mode_rolls_back_when_the_journal_already_exists(): void {
        $inventory = $this->makeInventoryFixture();
        $this->setPostingMode(PostingDocumentType::StockEntry, 'on');

        $entry = $this->makeStockEntry2('item_receipt', ['target_warehouse_id' => $inventory['warehouse']->id], [], $inventory);
        app(JournalService::class)->postPair($this->stock->id, $this->difference->id, 10_000, $entry, CarbonImmutable::now(), 'default');
        $before = $this->balances();

        try {
            app(StockEntryService::class)->onApproved($entry);
            $this->fail('Approve harus digulung.');
        } catch (DuplicatePostingException) {
            $this->assertSame($before, $this->balances(), 'Mutasi saldo dan stok tidak diulang saat jurnal sudah ada.');
            $this->assertSame(1, Journal::count());
            $this->assertSame(0, StockLedgerEntry::count(), 'Mutasi stok digulung.');
        }
    }
}
