<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 bagian B untuk Purchase Receipt: uji yang memanggil `PurchaseReceiptService::onApproved`
 * sungguhan. Nilai per baris dihitung service (ALUR-2, invoice approve lebih dulu), jurnal diproses sinkron lewat
 * listener, dan akun `stock` dicatat ke `purchase_receipt_items.posted_account_id`.
 */
class PurchaseReceiptApprovalWritebackTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $stock;
    private Account $srnb;
    private Warehouse $warehouse;
    private PurchaseOrder $po;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PurchaseOrder::class, PurchaseReceipt::class, PurchaseInvoice::class, StockLedgerEntry::class]);
        Event::fake([
            PurchaseOrderReceiveStatusRecalculationRequested::class,
            PurchaseRequestReceiveStatusRecalculationRequested::class,
            FixedAssetItemApproved::class,
        ]);

        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb  = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->enableEnginePosting(['stock' => $this->stock, 'stock_received_but_not_billed' => $this->srnb]);

        $this->warehouse = Warehouse::create(['branch_id' => $this->branch->id, 'name' => 'Gudang PR', 'code' => 'WH-PR']);
        $this->po        = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-WB-1',
            'date'          => now(),
            'created_by_id' => $this->user->id,
            'status'        => [FormStatus::SUBMITTED],
        ]));
    }

    /** @return array{0: ItemVariant, 1: ItemUnit} */
    private function makeVariant(?string $categoryId = null): array {
        $item     = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id, 'category_id' => $categoryId]);
        $unit     = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $variant->update(['default_unit_id' => $unit->id]);

        return [$variant, $itemUnit];
    }

    private function makePoItem(ItemVariant $variant, ItemUnit $unit, float $quantity, float $rate): PurchaseOrderItem {
        return PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
            'rate'                => $rate,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $unit->id,
        ]);
    }

    private function makeReceipt(): PurchaseReceipt {
        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));
    }

    private function makeRow(PurchaseReceipt $receipt, PurchaseOrderItem $poItem, ItemVariant $variant, ItemUnit $unit, float $quantity): PurchaseReceiptItem {
        return PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $variant->id,
            'item_unit_id'           => $unit->id,
            'quantity'               => $quantity,
            'target_warehouse_id'    => $this->warehouse->id,
        ]);
    }

    /**
     * Invoice yang sudah di-approve lebih dulu (ALUR-2): satu invoice, tiap entri `[PO Item, jumlah, rate]` jadi satu
     * baris invoice.
     *
     * @param  list<array{0: PurchaseOrderItem, 1: float, 2: float}>  $lines
     */
    private function seedApprovedInvoice(array $lines): void {
        $credit  = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit');
        $expense = $this->makeAccount('5000', 'Biaya', 'expense', 'debit');

        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $credit->id,
            'expanse_head_account_id' => $expense->id,
            'created_by_id'           => $this->user->id,
        ]));
        $invoice->forceFill(['submitted_at' => now()])->save();
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseInvoice::class,
            'reference_id'   => $invoice->id,
        ]);

        foreach ($lines as [$poItem, $quantity, $rate]) {
            $poItem->update(['billed_quantity' => $poItem->billed_quantity + $quantity]);
            PurchaseInvoiceItem::create([
                'purchase_invoice_id'    => $invoice->id,
                'purchase_order_item_id' => $poItem->id,
                'item_id'                => $poItem->item_id,
                'quantity'               => $quantity,
                'rate'                   => $rate,
            ]);
        }
    }

    public function test_one_receipt_line_allocated_to_two_invoice_items_sums_the_amounts_and_records_the_account(): void {
        [$variant, $unit] = $this->makeVariant();
        $poItem           = $this->makePoItem($variant, $unit, 10, 1000);
        // Satu baris receipt (10) dialokasikan ke dua baris invoice: 4 x 1500 + 6 x 2000 = 18.000.
        $this->seedApprovedInvoice([[$poItem, 4, 1500], [$poItem, 6, 2000]]);
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, $poItem, $variant, $unit, 10);

        (new PurchaseReceiptService)->onApproved($receipt);

        $this->assertEquals(10, $poItem->fresh()->received_quantity);
        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 18000, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 18000],
        ]);
        $this->assertPostingStatus($receipt, 'posted');
        // Bila akumulasi menimpa (12.000 != 18.000), jurnal jatuh ke tingkat dokumen dan akun tidak tercatat.
        $this->assertSame($this->stock->id, $row->fresh()->posted_account_id);
    }

    public function test_approval_with_two_lines_posts_a_journal_per_line_amount_and_records_each_account(): void {
        [$variantA, $unitA] = $this->makeVariant();
        [$variantB, $unitB] = $this->makeVariant();
        $poItemA            = $this->makePoItem($variantA, $unitA, 10, 1000);
        $poItemB            = $this->makePoItem($variantB, $unitB, 10, 1000);
        $this->seedApprovedInvoice([[$poItemA, 3, 100], [$poItemB, 5, 200]]);
        $receipt = $this->makeReceipt();
        $rowA    = $this->makeRow($receipt, $poItemA, $variantA, $unitA, 3);
        $rowB    = $this->makeRow($receipt, $poItemB, $variantB, $unitB, 5);

        (new PurchaseReceiptService)->onApproved($receipt);

        // 3 x 100 + 5 x 200 = 1.300
        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 1300, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 1300],
        ]);
        $this->assertSame($this->stock->id, $rowA->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $rowB->fresh()->posted_account_id);
    }
}
