<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged;
use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
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
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec purchase-invoice-off-po-items, Requirement 3-7, 9: approve invoice untuk
 * baris receipt di luar PO dan item bebas, sisi receipt (ALUR-2 baris berdiri
 * sendiri), over-bill, retur, dan regresi baris normal.
 */
class PurchaseInvoiceOffPoApprovalTest extends TestCase {
    use RefreshDatabase;

    private PurchaseInvoiceService $invoiceService;
    private PurchaseReceiptService $receiptService;
    private User $user;
    private Warehouse $warehouse;
    private PurchaseOrder $po;
    private PurchaseOrderItem $xItem;
    private ItemVariant $xVariant;
    private ItemVariant $yVariant;
    private ItemUnit $xUnit;
    private ItemUnit $yUnit;
    private Account $credit;
    private Account $expense;

    protected function setUp(): void {
        parent::setUp();
        $this->invoiceService = new PurchaseInvoiceService;
        $this->receiptService = new PurchaseReceiptService;

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        if (! Schema::hasColumns('accounts', ['lft', 'rgt', 'depth'])) {
            Schema::table('accounts', function ($table) {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            });
        }
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class, PurchaseInvoice::class, StockLedgerEntry::class] as $model) {
            $model::initPermissions();
        }
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        CountryFactory::new()->create(['code' => 'IDN']);

        Event::fake([
            PurchaseReceiptGeneralLedgerPostingRequested::class,
            PurchaseOrderReceiveStatusRecalculationRequested::class,
            PurchaseRequestReceiveStatusRecalculationRequested::class,
            FixedAssetItemApproved::class,
            PurchaseInvoiceGeneralLedgerPostingRequested::class,
            PurchaseOrderBillStatusRecalculationRequested::class,
            PurchaseOrderItemBillingChanged::class,
        ]);

        $this->user      = User::factory()->create();
        $this->warehouse = WarehouseFactory::new()->create();
        $this->actingAs($this->user);

        [$this->xVariant, $this->xUnit] = $this->makeVariant();
        [$this->yVariant, $this->yUnit] = $this->makeVariant();
        $this->credit                   = Account::create(['account_name' => 'Accounts Payable', 'account_number' => '2000', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $this->expense                  = Account::create(['account_name' => 'Expense Head', 'account_number' => '5000', 'root_type' => 'expense', 'report_type' => 'profit_and_loss']);

        $supplier = SupplierFactory::new()->create();
        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
        $this->xItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $this->xVariant->id,
            'quantity'            => 10,
            'rate'                => 1000,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $this->xUnit->id,
        ]);
    }

    /** @return array{0: ItemVariant, 1: ItemUnit} */
    private function makeVariant(): array {
        $item     = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit     = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $variant->update(['default_unit_id' => $unit->id]);

        return [$variant, $itemUnit];
    }

    /** Receipt dengan satu baris berdiri sendiri (item Y), di-approve lewat service. */
    private function approveStandaloneReceipt(float $quantity = 6): PurchaseReceiptItem {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));
        $row = PurchaseReceiptItem::create([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $this->yVariant->id,
            'item_unit_id'        => $this->yUnit->id,
            'quantity'            => $quantity,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
        $this->receiptService->onApproved($receipt);
        // seperti alur nyata: submit memicu DocumentSubmitted -> ModelConnection PO -> Receipt
        // dan status/submitted_at terisi setelah approve.
        $receipt->forceFill(['submitted_at' => now(), 'status' => [FormStatus::RECEIVED]])->save();
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $receipt->id,
        ]);

        return $row->fresh();
    }

    /** Buat invoice draft dengan satu baris, lalu approve (atau biarkan draft bila $approve false). */
    private function makeInvoice(array $itemAttrs, bool $approve = true, array $invoiceAttrs = []): PurchaseInvoiceItem {
        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create(array_merge([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $this->credit->id,
            'expanse_head_account_id' => $this->expense->id,
            'created_by_id'           => $this->user->id,
        ], $invoiceAttrs)));
        $invoiceItem = PurchaseInvoiceItem::create(array_merge(['purchase_invoice_id' => $invoice->id], $itemAttrs));

        if ($approve) {
            $this->invoiceService->onApproved($invoice);
            $invoice->forceFill(['submitted_at' => now()])->save();
            ModelConnection::create([
                'model_type'     => PurchaseOrder::class,
                'model_id'       => $this->po->id,
                'reference_type' => PurchaseInvoice::class,
                'reference_id'   => $invoice->id,
            ]);
        }

        return $invoiceItem->fresh();
    }

    private function yStock(): Stock {
        return Stock::where('item_variant_id', $this->yVariant->id)->where('warehouse_id', $this->warehouse->id)->firstOrFail();
    }

    // --- baris receipt ------------------------------------------------------

    #[Test]
    public function receipt_row_invoice_values_pending_sle_and_tracks_billed_quantity(): void {
        $row = $this->approveStandaloneReceipt(6);
        $this->assertFalse($this->yStock()->stock_queue[0]['is_valuated']);

        $this->makeInvoice(['purchase_receipt_item_id' => $row->id, 'item_id' => $row->item_id, 'quantity' => 6, 'rate' => 1500]);

        $sle = StockLedgerEntry::where('item_id', $this->yVariant->id)->where('referenceable_type', PurchaseReceipt::class)->first();
        $this->assertTrue((bool) $sle->is_valuated);
        $this->assertEquals(9000, $sle->change_in_stock_value);
        $entry = $this->yStock()->stock_queue[0];
        $this->assertTrue($entry['is_valuated']);
        $this->assertEquals(1500, $entry['rate']);
        $this->assertEquals(6, $row->fresh()->billed_quantity);
        Event::assertDispatched(PurchaseInvoiceGeneralLedgerPostingRequested::class, fn ($e) => $e->totalStockGL === 9000.0);
    }

    #[Test]
    public function receipt_row_invoice_does_not_touch_po_item_billing(): void {
        $row = $this->approveStandaloneReceipt(6);

        $this->makeInvoice(['purchase_receipt_item_id' => $row->id, 'item_id' => $row->item_id, 'quantity' => 6, 'rate' => 1500]);

        Event::assertNotDispatched(PurchaseOrderItemBillingChanged::class);
        $this->assertEquals(0, $this->xItem->fresh()->billed_quantity);
    }

    #[Test]
    public function receipt_row_over_bill_values_available_and_leaves_rest_pending_on_invoice(): void {
        $row = $this->approveStandaloneReceipt(6);

        $invoiceItem = $this->makeInvoice(['purchase_receipt_item_id' => $row->id, 'item_id' => $row->item_id, 'quantity' => 10, 'rate' => 1500]);

        $valued = StockLedgerEntry::where('item_id', $this->yVariant->id)->where('referenceable_type', PurchaseReceipt::class)->where('is_valuated', true)->sum('quantity_change');
        $this->assertEquals(6, $valued);
        $pending = StockLedgerEntry::where('referenceable_type', PurchaseInvoice::class)->where('referenceable_id', $invoiceItem->purchase_invoice_id)->where('is_valuated', false)->first();
        $this->assertNotNull($pending, 'sisa over-bill menjadi SLE pending yang menunjuk invoice');
        $this->assertEquals(4, $pending->quantity_change);
        $this->assertEquals($this->yVariant->id, $pending->item_id);
        $this->assertEquals(10, $row->fresh()->billed_quantity, 'over-bill tetap tercatat');
    }

    #[Test]
    public function receipt_row_invoice_does_not_value_other_rows_of_the_same_receipt(): void {
        $row   = $this->approveStandaloneReceipt(6);
        $other = PurchaseReceiptItem::create([
            'purchase_receipt_id' => $row->purchase_receipt_id,
            'item_id'             => $this->xVariant->id,
            'item_unit_id'        => $this->xUnit->id,
            'quantity'            => 2,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
        // SLE belum bernilai untuk item lain di receipt yang sama
        StockLedgerEntry::create([
            'referenceable_type'         => PurchaseReceipt::class,
            'referenceable_id'           => $row->purchase_receipt_id,
            'item_id'                    => $this->xVariant->id,
            'warehouse_id'               => $this->warehouse->id,
            'item_unit_id'               => $this->xUnit->id,
            'conversion_factor'          => 1,
            'quantity_change'            => 2,
            'quantity_after_transaction' => 2,
            'is_valuated'                => false,
            'transaction_date'           => now(),
        ]);

        $this->makeInvoice(['purchase_receipt_item_id' => $row->id, 'item_id' => $row->item_id, 'quantity' => 6, 'rate' => 1500]);

        $this->assertFalse((bool) StockLedgerEntry::where('item_id', $this->xVariant->id)->first()->is_valuated);
        $this->assertEquals(0, $other->fresh()->billed_quantity);
    }

    // --- item bebas ---------------------------------------------------------

    #[Test]
    public function free_item_invoice_matches_existing_standalone_receipt_row_fifo(): void {
        $row = $this->approveStandaloneReceipt(6);

        $invoiceItem = $this->makeInvoice(['item_id' => $this->yVariant->id, 'quantity' => 10, 'rate' => 1500]);

        $sle = StockLedgerEntry::where('item_id', $this->yVariant->id)->where('referenceable_type', PurchaseReceipt::class)->first();
        $this->assertTrue((bool) $sle->is_valuated);
        $this->assertEquals(9000, $sle->change_in_stock_value);
        $this->assertEquals(6, $row->fresh()->billed_quantity);
        $this->assertEquals(6, $invoiceItem->allocated_qty, 'porsi yang sudah dialokasikan ke receipt');
        Event::assertNotDispatched(PurchaseOrderItemBillingChanged::class);
        Event::assertDispatched(PurchaseInvoiceGeneralLedgerPostingRequested::class, fn ($e) => $e->totalStockGL === 9000.0);
    }

    #[Test]
    public function free_item_invoice_without_receipt_waits_and_creates_no_sle(): void {
        $invoiceItem = $this->makeInvoice(['item_id' => $this->yVariant->id, 'quantity' => 10, 'rate' => 1500]);

        $this->assertEquals(0, $invoiceItem->allocated_qty);
        $this->assertDatabaseCount('stock_ledger_entries', 0);
        Event::assertDispatched(PurchaseInvoiceGeneralLedgerPostingRequested::class, fn ($e) => $e->totalStockGL === 0.0);
    }

    #[Test]
    public function free_item_invoice_only_matches_receipts_of_the_same_po_and_item(): void {
        $this->approveStandaloneReceipt(6);

        $this->makeInvoice(['item_id' => $this->xVariant->id, 'quantity' => 6, 'rate' => 1500]); // item lain

        $this->assertFalse((bool) StockLedgerEntry::where('item_id', $this->yVariant->id)->first()->is_valuated);
    }

    // --- sisi receipt (ALUR-2 baris berdiri sendiri) --------------------------

    #[Test]
    public function standalone_receipt_row_allocates_from_free_invoice_item_approved_first(): void {
        $invoiceItem = $this->makeInvoice(['item_id' => $this->yVariant->id, 'quantity' => 10, 'rate' => 1500]);

        $row = $this->approveStandaloneReceipt(6);

        $queue = $this->yStock()->stock_queue;
        $this->assertCount(1, $queue);
        $this->assertTrue($queue[0]['is_valuated']);
        $this->assertEquals(1500, $queue[0]['rate']);
        $this->assertEquals(6, $queue[0]['quantity']);
        $this->assertEquals(6, $invoiceItem->fresh()->allocated_qty);
        $this->assertEquals(6, $row->fresh()->billed_quantity);
        Event::assertDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class, fn ($e) => $e->totalRatesForGL === 9000.0);
    }

    #[Test]
    public function standalone_receipt_row_allocates_from_invoice_created_directly_without_model_connection(): void {
        // invoice yang dibuat langsung dari form hanya punya `purchase_order_id`, tanpa ModelConnection
        $invoiceItem = $this->makeInvoice(['item_id' => $this->yVariant->id, 'quantity' => 10, 'rate' => 1500]);
        ModelConnection::query()->delete();

        $row = $this->approveStandaloneReceipt(6);

        $this->assertEquals(6, $invoiceItem->fresh()->allocated_qty);
        $this->assertEquals(6, $row->fresh()->billed_quantity);
        $this->assertTrue($this->yStock()->stock_queue[0]['is_valuated']);
    }

    #[Test]
    public function standalone_receipt_row_values_only_available_invoice_quantity_and_leaves_rest_pending(): void {
        $invoiceItem = $this->makeInvoice(['item_id' => $this->yVariant->id, 'quantity' => 4, 'rate' => 1500]);

        $row = $this->approveStandaloneReceipt(6);

        $queue = $this->yStock()->stock_queue;
        $this->assertCount(2, $queue);
        $this->assertTrue($queue[0]['is_valuated']);
        $this->assertEquals(4, $queue[0]['quantity']);
        $this->assertFalse($queue[1]['is_valuated']);
        $this->assertEquals(2, $queue[1]['quantity']);
        $this->assertEquals(4, $invoiceItem->fresh()->allocated_qty);
        $this->assertEquals(4, $row->fresh()->billed_quantity);
    }

    #[Test]
    public function standalone_receipt_row_ignores_invoice_items_that_are_fully_allocated_or_for_other_items(): void {
        $this->makeInvoice(['item_id' => $this->yVariant->id, 'quantity' => 3, 'rate' => 1500, 'allocated_qty' => 3]);
        $this->makeInvoice(['item_id' => $this->xVariant->id, 'quantity' => 6, 'rate' => 1500]);

        $this->approveStandaloneReceipt(6);

        $this->assertFalse($this->yStock()->stock_queue[0]['is_valuated']);
        Event::assertNotDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class);
    }

    // --- retur & regresi ------------------------------------------------------

    #[Test]
    public function return_invoice_of_receipt_row_reverses_billed_quantity(): void {
        $row     = $this->approveStandaloneReceipt(6);
        $invItem = $this->makeInvoice(['purchase_receipt_item_id' => $row->id, 'item_id' => $row->item_id, 'quantity' => 6, 'rate' => 1500]);
        $this->assertEquals(6, $row->fresh()->billed_quantity);

        $this->makeInvoice(
            ['item_id' => $row->item_id, 'quantity' => 2, 'rate' => 1500, 'return_against_item_id' => $invItem->id],
            invoiceAttrs: ['return_against_id' => $invItem->purchase_invoice_id],
        );

        $this->assertEquals(4, $row->fresh()->billed_quantity);
    }

    #[Test]
    public function normal_row_invoice_still_dispatches_po_item_billing_and_values_normal_receipt(): void {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));
        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $this->xItem->id,
            'item_id'                => $this->xVariant->id,
            'item_unit_id'           => $this->xUnit->id,
            'quantity'               => 4,
            'target_warehouse_id'    => $this->warehouse->id,
        ]);
        $this->receiptService->onApproved($receipt);
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $receipt->id,
        ]);

        $this->makeInvoice(['purchase_order_item_id' => $this->xItem->id, 'item_id' => $this->xVariant->id, 'quantity' => 4, 'rate' => 1500]);

        Event::assertDispatched(PurchaseOrderItemBillingChanged::class);
        $sle = StockLedgerEntry::where('item_id', $this->xVariant->id)->where('referenceable_type', PurchaseReceipt::class)->first();
        $this->assertTrue((bool) $sle->is_valuated);
        $this->assertEquals(6000, $sle->change_in_stock_value);
    }

    #[Test]
    public function service_create_stores_receipt_item_link_and_free_item_id(): void {
        $row = $this->approveStandaloneReceipt(6);

        $invoice = $this->invoiceService->create([
            'date'                 => now()->toDateString(),
            'branch'               => ['code' => 'MAIN'],
            'purchase_order'       => ['id' => $this->po->id],
            'supplier'             => ['id' => $this->po->supplier_id],
            'expense_head_account' => ['id' => $this->expense->id],
            'credit_account'       => ['id' => $this->credit->id],
            'items'                => [
                [
                    'id'                    => 'r1',
                    'purchase_receipt_item' => ['id' => $row->id],
                    'quantity'              => 6,
                    'rate'                  => 1500,
                    'unit'                  => ['id' => $this->yUnit->id],
                ],
                [
                    'id'       => 'r2',
                    'item'     => ['id' => $this->xVariant->id],
                    'quantity' => 3,
                    'rate'     => 900,
                    'unit'     => ['id' => $this->xUnit->id],
                ],
            ],
        ]);

        $items = $invoice->items()->orderBy('quantity', 'desc')->get();
        $this->assertSame($row->id, $items[0]->purchase_receipt_item_id);
        $this->assertSame($this->yVariant->id, $items[0]->item_id);
        $this->assertNull($items[0]->purchase_order_item_id);
        $this->assertSame($this->xVariant->id, $items[1]->item_id);
        $this->assertNull($items[1]->purchase_receipt_item_id);
    }
}
