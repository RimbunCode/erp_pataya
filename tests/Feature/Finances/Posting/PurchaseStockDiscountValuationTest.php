<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 13.4 (Requirement 14.3; keputusan pemilik produk 22 November 2026): diskon baris STOK
 * Purchase Invoice mengurangi nilai persediaan. SLE dan `stock_queue` dinilai pada rate bersih
 * (`rate x (basic - diskon) / basic`) pada kedua alur (ALUR-1 receipt lebih dulu dan ALUR-2 invoice lebih dulu), jurnal
 * `stock` memakai nilai bersih itu, dan SRNB tidak lagi menyisakan diskon (tanpa pajak saldo SRNB nol). Retur Purchase
 * Receipt mengurangi queue dan mengkredit persediaan pada rate entri queue.
 *
 * Fixture: 2 unit @ 1.000, diskon 200, tanpa pajak -> nilai persediaan 1.800 (rate 900), bukan 2.000 (rate 1.000).
 */
class PurchaseStockDiscountValuationTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    private Account $payable;
    private Account $srnb;
    private Account $stockAccount;
    private Warehouse $warehouse;
    private ItemVariant $variant;
    private ItemUnit $itemUnit;
    private PurchaseOrder $po;
    private PurchaseOrderItem $poItem;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PurchaseInvoice::class, PurchaseOrder::class, PurchaseReceipt::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockLedgerEntry::class]);

        $this->payable      = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->srnb         = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->stockAccount = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil stok', '2020-01-01', null, [
            'payable'                       => $this->payable->id,
            'expense'                       => $this->srnb->id,
            'stock'                         => $this->stockAccount->id,
            'stock_received_but_not_billed' => $this->srnb->id,
        ]));

        $this->warehouse                  = WarehouseFactory::new()->create();
        [$this->variant, $this->itemUnit] = $this->makeVariant();

        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-VAL-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
        $this->poItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $this->variant->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $this->itemUnit->id,
        ]);

        $stock = Stock::create([
            'item_variant_id'   => $this->variant->id,
            'warehouse_id'      => $this->warehouse->id,
            'conversion_factor' => 1,
            'item_unit_id'      => $this->itemUnit->id,
            'stock_queue'       => [],
        ]);
        $stock->updateDetails('increment', 'incomings', $this->po->code, 2);
    }

    /**
     * @return array{0: ItemVariant, 1: ItemUnit}
     */
    private function makeVariant(): array {
        $item     = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $unit     = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $variant->update(['default_unit_id' => $unit->id]);

        return [$variant, $itemUnit];
    }

    /**
     * @param  array<string, mixed>  $rowAttributes
     */
    private function approveReceipt(int|float $quantity = 2, array $rowAttributes = [], ?PurchaseReceipt $returnAgainst = null): PurchaseReceipt {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
            'return_against_id' => $returnAgainst?->id,
        ]));
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $receipt->id,
        ]);
        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $this->poItem->id,
            'item_id'                => $this->variant->id,
            'item_unit_id'           => $this->itemUnit->id,
            'quantity'               => $quantity,
            'target_warehouse_id'    => $this->warehouse->id,
            ...$rowAttributes,
        ]);

        app(PurchaseReceiptService::class)->onApproved($receipt);

        return $receipt->fresh();
    }

    /**
     * @param  array<string, mixed>  $itemAttributes
     */
    private function approveInvoice(float $discount = 200, array $itemAttributes = []): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'                    => now(),
            'expanse_head_account_id' => $this->srnb->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $this->po->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);
        // Seperti saat submit: ALUR-2 (Purchase Receipt) mencari invoice lewat koneksi PO dan `submitted_at`.
        $invoice->forceFill(['submitted_at' => now()])->save();
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseInvoice::class,
            'reference_id'   => $invoice->id,
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $this->poItem->id,
            'item_id'                => $this->variant->id,
            'quantity'               => 2,
            'rate'                   => 1000,
            'tax_rate'               => 0,
            'discount_amount'        => $discount,
            ...$itemAttributes,
        ]);
        app(PurchaseInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh();
    }

    /**
     * @param  array<string, array{date: string, lines: list<array{0: string, 1: float, 2: float}>}>  $signature
     * @return array<string, array{0: float, 1: float}>
     */
    private function linesOf(array $signature, string $purpose): array {
        $result = [];
        foreach ($signature[$purpose]['lines'] ?? [] as [$account, $debit, $credit]) {
            $result[$account] = [$debit, $credit];
        }
        ksort($result);

        return $result;
    }

    /**
     * Saldo kredit bersih SRNB (kredit - debit) atas semua jurnal dokumen yang diberikan.
     *
     * @param  list<Model>  $documents
     */
    private function srnbCreditBalance(array $documents): float {
        $balance = 0.0;
        foreach ($documents as $document) {
            foreach ($this->journalSignature($document) as $journal) {
                foreach ($journal['lines'] as [$account, $debit, $credit]) {
                    if ($account === '2100') {
                        $balance += $credit - $debit;
                    }
                }
            }
        }

        return round($balance, 2);
    }

    private function valuedEntry(): StockLedgerEntry {
        return StockLedgerEntry::query()
            ->where('referenceable_type', PurchaseReceipt::class)
            ->where('quantity_change', '>', 0)
            ->firstOrFail();
    }

    private function stock(): Stock {
        return Stock::query()->where('item_variant_id', $this->variant->id)->where('warehouse_id', $this->warehouse->id)->firstOrFail();
    }

    public function test_net_rate_applies_the_line_discount_proportionally(): void {
        $withDiscount = new PurchaseInvoiceItem(['rate' => 1000, 'basic_amount' => 2000, 'discount_amount' => 200]);
        $this->assertEqualsWithDelta(900.0, $withDiscount->netRate(), 1e-9);

        $noDiscount = new PurchaseInvoiceItem(['rate' => 1000, 'basic_amount' => 2000, 'discount_amount' => 0]);
        $this->assertEqualsWithDelta(1000.0, $noDiscount->netRate(), 1e-9);

        $zeroBasic = new PurchaseInvoiceItem(['rate' => 1000, 'basic_amount' => 0, 'discount_amount' => 200]);
        $this->assertEqualsWithDelta(1000.0, $zeroBasic->netRate(), 1e-9, 'guard basic nol: rate apa adanya');

        $overDiscount = new PurchaseInvoiceItem(['rate' => 1000, 'basic_amount' => 2000, 'discount_amount' => 2500]);
        $this->assertEqualsWithDelta(0.0, $overDiscount->netRate(), 1e-9, 'tidak pernah negatif');
    }

    public function test_alur1_receipt_first_values_stock_at_the_net_rate_and_leaves_no_discount_in_srnb(): void {
        $receipt = $this->approveReceipt();
        $invoice = $this->approveInvoice();

        $entry = $this->valuedEntry();
        $this->assertTrue((bool) $entry->is_valuated);
        $this->assertEqualsWithDelta(900.0, (float) $entry->valuation_rate, 1e-6);
        $this->assertEqualsWithDelta(1800.0, (float) $entry->change_in_stock_value, 1e-6);

        $queue = $this->stock()->stock_queue;
        $this->assertCount(1, $queue);
        $this->assertEqualsWithDelta(900.0, (float) $queue[0]['rate'], 1e-6);
        $this->assertTrue($queue[0]['is_valuated']);

        $signature = $this->journalSignature($invoice);
        $this->assertSame(['1300' => [1800.0, 0.0], '2100' => [0.0, 1800.0]], $this->linesOf($signature, 'stock'), 'persediaan masuk bersih setelah diskon');
        $this->assertSame(['2000' => [0.0, 1800.0], '2100' => [1800.0, 0.0]], $this->linesOf($signature, 'expense'));
        $this->assertEqualsWithDelta(0.0, $this->srnbCreditBalance([$invoice, $receipt]), 1e-6, 'tanpa pajak SRNB nol: tidak ada residu diskon');
    }

    public function test_alur2_invoice_first_values_stock_at_the_net_rate_and_leaves_no_discount_in_srnb(): void {
        $invoice = $this->approveInvoice();
        $this->assertSame([], $this->linesOf($this->journalSignature($invoice), 'stock'), 'belum ada receipt: tidak ada jurnal stock di invoice');

        $receipt = $this->approveReceipt();

        $entry = $this->valuedEntry();
        $this->assertTrue((bool) $entry->is_valuated);
        $this->assertEqualsWithDelta(900.0, (float) $entry->valuation_rate, 1e-6);
        $this->assertEqualsWithDelta(1800.0, (float) $entry->change_in_stock_value, 1e-6);

        $queue = $this->stock()->stock_queue;
        $this->assertEqualsWithDelta(900.0, (float) $queue[0]['rate'], 1e-6);

        $this->assertSame(['1300' => [1800.0, 0.0], '2100' => [0.0, 1800.0]], $this->linesOf($this->journalSignature($receipt), 'default'));
        $this->assertEqualsWithDelta(0.0, $this->srnbCreditBalance([$invoice, $receipt]), 1e-6);
    }

    public function test_a_non_divisible_net_rate_keeps_the_journals_balanced_within_rounding(): void {
        // 3 unit @ 1.000, diskon 100: rate bersih 966,666... (tidak habis dibagi), nilai persediaan 2.900.
        $this->poItem->update(['quantity' => 3]);
        $receipt = $this->approveReceipt(3);
        $invoice = $this->approveInvoice(100, ['quantity' => 3]);

        $this->assertEqualsWithDelta(1000 * 2900 / 3000, (float) $this->valuedEntry()->valuation_rate, 1e-4);

        $signature = $this->journalSignature($invoice);
        foreach (['stock', 'expense'] as $purpose) {
            $lines = $this->linesOf($signature, $purpose);
            $this->assertNotSame([], $lines, "jurnal {$purpose} harus ada");
            $debit  = array_sum(array_column($lines, 0));
            $credit = array_sum(array_column($lines, 1));
            $this->assertEqualsWithDelta($debit, $credit, 0.005, "jurnal {$purpose} seimbang");
        }

        $this->assertEqualsWithDelta(2900.0, $this->linesOf($signature, 'stock')['1300'][0], 0.01, 'persediaan masuk bersih setelah diskon');
        $this->assertEqualsWithDelta(0.0, $this->srnbCreditBalance([$invoice, $receipt]), 0.01, 'residu SRNB hanya selisih pembulatan');
    }

    public function test_an_invoice_without_discount_keeps_the_gross_rate(): void {
        $this->approveReceipt();
        $invoice = $this->approveInvoice(0);

        $this->assertEqualsWithDelta(1000.0, (float) $this->valuedEntry()->valuation_rate, 1e-6);
        $this->assertSame(['1300' => [2000.0, 0.0], '2100' => [0.0, 2000.0]], $this->linesOf($this->journalSignature($invoice), 'stock'));
    }

    public function test_receipt_return_after_net_valuation_reduces_the_queue_and_credits_stock_at_the_net_rate(): void {
        $original = $this->approveReceipt();
        $this->approveInvoice();
        $originalRow = $original->items()->firstOrFail();

        $return = $this->approveReceipt(1, ['return_against_item_id' => $originalRow->id], $original);

        $queue = $this->stock()->stock_queue;
        $this->assertEqualsWithDelta(1.0, (float) $queue[0]['quantity'], 1e-9, 'queue berkurang sebesar kuantitas retur walau rate bersih berbeda dari rate PO');
        $this->assertEqualsWithDelta(900.0, (float) $queue[0]['rate'], 1e-6);

        $this->assertSame(['1300' => [0.0, 900.0], '2100' => [900.0, 0.0]], $this->linesOf($this->journalSignature($return), 'default'), 'retur mengkredit persediaan sebesar 900 per unit');

        $returnEntry = StockLedgerEntry::query()->where('referenceable_id', $return->id)->firstOrFail();
        $this->assertEqualsWithDelta(-900.0, (float) $returnEntry->change_in_stock_value, 1e-6);
    }

    public function test_receipt_return_before_billing_still_uses_the_po_rate(): void {
        $original    = $this->approveReceipt();
        $originalRow = $original->items()->firstOrFail();

        $return = $this->approveReceipt(1, ['return_against_item_id' => $originalRow->id], $original);

        $this->assertSame(['1300' => [0.0, 1000.0], '2100' => [1000.0, 0.0]], $this->linesOf($this->journalSignature($return), 'default'));
        $this->assertEqualsWithDelta(1.0, (float) $this->stock()->stock_queue[0]['quantity'], 1e-9);
    }

    public function test_a_receipt_row_outside_the_po_is_valued_at_the_net_rate_of_the_invoice_line(): void {
        // Baris receipt di luar PO (tanpa PO Item) yang ditagih lewat `purchase_receipt_item_id` (billReceiptRow).
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));
        ModelConnection::create(['model_type' => PurchaseOrder::class, 'model_id' => $this->po->id, 'reference_type' => PurchaseReceipt::class, 'reference_id' => $receipt->id]);
        [$otherVariant, $otherUnit] = $this->makeVariant();
        $row                        = PurchaseReceiptItem::create([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $otherVariant->id,
            'item_unit_id'        => $otherUnit->id,
            'quantity'            => 2,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
        app(PurchaseReceiptService::class)->onApproved($receipt);

        $invoice = PurchaseInvoice::create([
            'date'                    => now(),
            'expanse_head_account_id' => $this->srnb->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $this->po->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'      => $invoice->id,
            'purchase_receipt_item_id' => $row->id,
            'item_id'                  => $otherVariant->id,
            'quantity'                 => 2,
            'rate'                     => 1000,
            'tax_rate'                 => 0,
            'discount_amount'          => 200,
        ]);
        app(PurchaseInvoiceService::class)->onApproved($invoice);

        $entry = StockLedgerEntry::query()->where('item_id', $otherVariant->id)->firstOrFail();
        $this->assertTrue((bool) $entry->is_valuated);
        $this->assertEqualsWithDelta(900.0, (float) $entry->valuation_rate, 1e-6);
        $this->assertSame(['1300' => [1800.0, 0.0], '2100' => [0.0, 1800.0]], $this->linesOf($this->journalSignature($invoice->fresh()), 'stock'));
    }
}
