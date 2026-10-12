<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Listeners\Asset\CreateAssetFromPurchase;
use App\Models\Asset\Asset;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
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
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Asset\AssetService;
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
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec purchase-receipt-off-po-items, Requirement 1, 3, 4, 5, 6, 10:
 * PurchaseReceiptService::onApproved untuk baris normal, substitusi
 * (menggantikan PO Item X), dan berdiri sendiri, serta retur baris substitusi.
 */
class PurchaseReceiptOffPoApprovalTest extends TestCase {
    use RefreshDatabase;

    private PurchaseReceiptService $service;
    private User $user;
    private Warehouse $warehouse;
    private PurchaseOrder $po;
    private PurchaseOrderItem $xItem;
    private ItemVariant $xVariant;
    private ItemVariant $yVariant;
    private ItemUnit $xUnit;
    private ItemUnit $yUnit;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new PurchaseReceiptService;

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
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class, PurchaseInvoice::class, StockLedgerEntry::class, Asset::class] as $model) {
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
        ]);

        $this->user      = User::factory()->create();
        $this->warehouse = WarehouseFactory::new()->create();
        $this->actingAs($this->user);

        [$this->xVariant, $this->xUnit] = $this->makeVariant();
        [$this->yVariant, $this->yUnit] = $this->makeVariant();

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

    private function makeReceipt(array $over = []): PurchaseReceipt {
        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create(array_merge([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ], $over)));
    }

    private function makeRow(PurchaseReceipt $receipt, array $over = []): PurchaseReceiptItem {
        return PurchaseReceiptItem::create(array_merge([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $this->yVariant->id,
            'item_unit_id'        => $this->yUnit->id,
            'quantity'            => 6,
            'target_warehouse_id' => $this->warehouse->id,
        ], $over));
    }

    /** Reservasi barang masuk PO untuk X di stok X (seperti saat PO di-approve). */
    private function seedXIncoming(float $quantity = 10): Stock {
        $stock = Stock::create([
            'item_variant_id'   => $this->xVariant->id,
            'warehouse_id'      => $this->warehouse->id,
            'conversion_factor' => 1,
            'item_unit_id'      => $this->xUnit->id,
            'stock_queue'       => [],
        ]);
        $stock->updateDetails('increment', 'incomings', $this->po->code, $quantity);

        return $stock->fresh();
    }

    /** Invoice X sudah di-approve duluan (ALUR-2): qty 10 @ 1500. */
    private function seedApprovedInvoiceForX(float $quantity = 10, float $rate = 1500): PurchaseInvoiceItem {
        $credit  = Account::create(['account_name' => 'Accounts Payable', 'account_number' => '2000', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $expense = Account::create(['account_name' => 'Expense Head', 'account_number' => '5000', 'root_type' => 'expense', 'report_type' => 'profit_and_loss']);

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
        $this->xItem->update(['billed_quantity' => $quantity]);

        return PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $this->xItem->id,
            'item_id'                => $this->xVariant->id,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ]);
    }

    private function yStock(): Stock {
        return Stock::where('item_variant_id', $this->yVariant->id)->where('warehouse_id', $this->warehouse->id)->firstOrFail();
    }

    // --- model --------------------------------------------------------------

    #[Test]
    public function receipt_item_stores_substitution_columns_and_relation(): void {
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, [
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 4,
        ]);

        $row = $row->fresh();
        $this->assertNull($row->purchase_order_item_id);
        $this->assertTrue($row->replacesPurchaseOrderItem->is($this->xItem));
        $this->assertSame(4.0, $row->replaced_quantity);
    }

    // --- regresi: baris normal ---------------------------------------------

    #[Test]
    public function normal_row_still_updates_po_item_and_incomings_as_before(): void {
        $xStock  = $this->seedXIncoming(10);
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'purchase_order_item_id' => $this->xItem->id,
            'item_id'                => $this->xVariant->id,
            'item_unit_id'           => $this->xUnit->id,
            'quantity'               => 4,
        ]);

        $this->service->onApproved($receipt);

        $this->assertEquals(4, $this->xItem->fresh()->received_quantity);
        $this->assertEquals(6, $xStock->fresh()->details['incomings'][$this->po->code]);
        $entry = Stock::where('item_variant_id', $this->xVariant->id)->first()->stock_queue[0];
        $this->assertEquals(1000, $entry['rate']);
        $this->assertFalse($entry['is_valuated']);
    }

    // --- substitusi ---------------------------------------------------------

    #[Test]
    public function substitution_with_existing_invoice_values_y_from_invoice_item_of_x(): void {
        $xStock      = $this->seedXIncoming(10);
        $invoiceItem = $this->seedApprovedInvoiceForX(10, 1500);
        $receipt     = $this->makeReceipt();
        $row         = $this->makeRow($receipt, [
            'quantity'                        => 6,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 6,
        ]);

        $this->service->onApproved($receipt);

        $queue = $this->yStock()->stock_queue;
        $this->assertCount(1, $queue);
        $this->assertEquals(1500, $queue[0]['rate']);
        $this->assertEquals(6, $queue[0]['quantity']);
        $this->assertTrue($queue[0]['is_valuated']);
        $this->assertSame($row->id, $queue[0]['receipt_item_id']);

        $sle = StockLedgerEntry::where('item_id', $this->yVariant->id)->first();
        $this->assertTrue((bool) $sle->is_valuated);
        $this->assertEquals(9000, $sle->change_in_stock_value);

        $this->assertEquals(6, $invoiceItem->fresh()->allocated_qty);
        $this->assertEquals(6, $this->xItem->fresh()->received_quantity, 'PO Item X dianggap terpenuhi oleh baris pengganti.');
        $this->assertEquals(4, $xStock->fresh()->details['incomings'][$this->po->code], 'incomings X dilepas sebesar replaced_quantity.');
        $this->assertDatabaseHas('gl_posting_statuses', ['referenceable_id' => $receipt->id]);
        Event::assertDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class, fn ($e) => $e->totalRatesForGL === 9000.0 && ! $e->isReturn);
        Event::assertDispatched(PurchaseOrderReceiveStatusRecalculationRequested::class);
        $this->assertNull($this->yStock()->details['incomings'][$this->po->code] ?? null, 'incomings Y tidak disentuh.');
    }

    #[Test]
    public function substitution_without_invoice_enters_stock_unvalued_but_fulfils_x(): void {
        $xStock  = $this->seedXIncoming(10);
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'quantity'                        => 6,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 6,
        ]);

        $this->service->onApproved($receipt);

        $queue = $this->yStock()->stock_queue;
        $this->assertFalse($queue[0]['is_valuated']);
        $this->assertEquals(6, $queue[0]['quantity']);
        $sle = StockLedgerEntry::where('item_id', $this->yVariant->id)->first();
        $this->assertFalse((bool) $sle->is_valuated);
        $this->assertEquals(0, $sle->valuation_rate);

        $this->assertEquals(6, $this->xItem->fresh()->received_quantity);
        $this->assertEquals(4, $xStock->fresh()->details['incomings'][$this->po->code]);
        $this->assertDatabaseMissing('gl_posting_statuses', ['referenceable_id' => $receipt->id]);
        Event::assertNotDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class);
    }

    #[Test]
    public function substitution_values_only_replaced_portion_and_leaves_excess_pending(): void {
        $this->seedApprovedInvoiceForX(10, 1500);
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'quantity'                        => 8,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 5,
        ]);

        $this->service->onApproved($receipt);

        $queue = $this->yStock()->stock_queue;
        $this->assertCount(2, $queue);
        $this->assertTrue($queue[0]['is_valuated']);
        $this->assertEquals(5, $queue[0]['quantity']);
        $this->assertFalse($queue[1]['is_valuated']);
        $this->assertEquals(3, $queue[1]['quantity']);
        $this->assertEquals(5, $this->xItem->fresh()->received_quantity);
        Event::assertDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class, fn ($e) => $e->totalRatesForGL === 7500.0);
    }

    #[Test]
    public function substitution_exceeding_remaining_of_x_aborts_approval_with_validation_error(): void {
        $this->xItem->update(['received_quantity' => 8]); // sisa 2
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'quantity'                        => 5,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 5,
        ]);

        try {
            $this->service->onApproved($receipt);
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items', $e->errors());
        }

        $this->assertDatabaseCount('stocks', 0);
        $this->assertEquals(8, $this->xItem->fresh()->received_quantity);
    }

    // --- berdiri sendiri ----------------------------------------------------

    #[Test]
    public function standalone_row_enters_stock_unvalued_and_does_not_touch_po(): void {
        $xStock  = $this->seedXIncoming(10);
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, ['quantity' => 3]);

        $this->service->onApproved($receipt);

        $queue = $this->yStock()->stock_queue;
        $this->assertFalse($queue[0]['is_valuated']);
        $this->assertEquals(0, $queue[0]['rate']);
        $this->assertEquals(3, $queue[0]['quantity']);
        $this->assertEquals(0, $this->xItem->fresh()->received_quantity);
        $this->assertEquals(10, $xStock->fresh()->details['incomings'][$this->po->code]);
        $this->assertDatabaseMissing('gl_posting_statuses', ['referenceable_id' => $receipt->id]);
        Event::assertDispatched(PurchaseOrderReceiveStatusRecalculationRequested::class);
    }

    #[Test]
    public function standalone_row_is_not_valued_even_when_po_has_invoices(): void {
        $this->seedApprovedInvoiceForX(10, 1500);
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, ['quantity' => 3]);

        $this->service->onApproved($receipt);

        $this->assertFalse($this->yStock()->stock_queue[0]['is_valuated']);
        Event::assertNotDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class);
    }

    // --- retur --------------------------------------------------------------

    #[Test]
    public function return_of_substitution_row_reverses_x_fulfilment_and_uses_queue_rate(): void {
        $xStock = $this->seedXIncoming(10);
        $this->seedApprovedInvoiceForX(10, 1500);
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, [
            'quantity'                        => 6,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 6,
        ]);
        $this->service->onApproved($receipt);
        Event::assertDispatchedTimes(PurchaseReceiptGeneralLedgerPostingRequested::class, 1);

        $return = $this->makeReceipt(['return_against_id' => $receipt->id]);
        $this->makeRow($return, ['quantity' => 2, 'return_against_item_id' => $row->id]);

        $this->service->onApproved($return);

        $this->assertEquals(4, $this->xItem->fresh()->received_quantity, '6 − 6×(2/6)');
        $this->assertEquals(6, $xStock->fresh()->details['incomings'][$this->po->code], 'incomings X dikembalikan proporsional.');
        $this->assertEquals(4, $this->yStock()->stock_queue[0]['quantity']);
        $this->assertEquals(2, $row->fresh()->returned_quantity);
        Event::assertDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class, fn ($e) => $e->isReturn && $e->totalRatesForGL === 3000.0);
    }

    #[Test]
    public function return_of_standalone_row_uses_queue_rate_and_does_not_touch_po(): void {
        $xStock  = $this->seedXIncoming(10);
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, ['quantity' => 5]);
        $this->service->onApproved($receipt);

        $return = $this->makeReceipt(['return_against_id' => $receipt->id]);
        $this->makeRow($return, ['quantity' => 2, 'return_against_item_id' => $row->id]);

        $this->service->onApproved($return);

        $this->assertEquals(3, $this->yStock()->stock_queue[0]['quantity']);
        $this->assertEquals(0, $this->xItem->fresh()->received_quantity);
        $this->assertEquals(10, $xStock->fresh()->details['incomings'][$this->po->code]);
        $this->assertEquals(2, $row->fresh()->returned_quantity);
    }

    // --- hand-off Purchase Invoice (Requirement 7) ---------------------------

    /** Invoice X (draft, belum diproses) lalu di-approve lewat service. */
    private function approveInvoiceForX(float $quantity, float $rate): PurchaseInvoice {
        $credit  = Account::create(['account_name' => 'Accounts Payable', 'account_number' => '2000', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $expense = Account::create(['account_name' => 'Expense Head', 'account_number' => '5000', 'root_type' => 'expense', 'report_type' => 'profit_and_loss']);

        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $credit->id,
            'expanse_head_account_id' => $expense->id,
            'created_by_id'           => $this->user->id,
        ]));
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $this->xItem->id,
            'item_id'                => $this->xVariant->id,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ]);
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => PurchaseReceipt::query()->latest('created_at')->value('id'),
        ]);

        (new PurchaseInvoiceService)->onApproved($invoice);

        return $invoice;
    }

    #[Test]
    public function invoice_of_x_values_pending_substitution_row_of_receipt_that_came_first(): void {
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'quantity'                        => 6,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 6,
        ]);
        $this->service->onApproved($receipt); // ALUR-1: belum bernilai
        $this->assertFalse($this->yStock()->stock_queue[0]['is_valuated']);

        $this->approveInvoiceForX(10, 1500);

        $sle = StockLedgerEntry::where('item_id', $this->yVariant->id)->where('referenceable_type', PurchaseReceipt::class)->first();
        $this->assertTrue((bool) $sle->is_valuated);
        $this->assertEquals(9000, $sle->change_in_stock_value);
        $this->assertEquals(1500, $sle->valuation_rate);
        $entry = $this->yStock()->stock_queue[0];
        $this->assertTrue($entry['is_valuated']);
        $this->assertEquals(1500, $entry['rate']);
    }

    #[Test]
    public function invoice_of_x_values_only_replaced_portion_of_substitution_row(): void {
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'quantity'                        => 8,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => 5,
        ]);
        $this->service->onApproved($receipt);

        $this->approveInvoiceForX(10, 1500);

        $sles = StockLedgerEntry::where('item_id', $this->yVariant->id)->where('referenceable_type', PurchaseReceipt::class)->get();
        $this->assertEquals(5, $sles->where('is_valuated', true)->sum('quantity_change'), 'hanya porsi pengganti yang dinilai');
        $this->assertEquals(3, $sles->where('is_valuated', false)->sum('quantity_change'), 'kelebihan tetap pending');
    }

    #[Test]
    public function invoice_of_x_does_not_value_standalone_row_in_same_receipt(): void {
        $receipt = $this->makeReceipt();
        $this->makeRow($receipt, [
            'purchase_order_item_id' => $this->xItem->id,
            'item_id'                => $this->xVariant->id,
            'item_unit_id'           => $this->xUnit->id,
            'quantity'               => 4,
        ]);
        $this->makeRow($receipt, ['quantity' => 3]); // berdiri sendiri
        $this->service->onApproved($receipt);

        $this->approveInvoiceForX(4, 1500);

        $xSle = StockLedgerEntry::where('item_id', $this->xVariant->id)->where('referenceable_type', PurchaseReceipt::class)->first();
        $ySle = StockLedgerEntry::where('item_id', $this->yVariant->id)->where('referenceable_type', PurchaseReceipt::class)->first();
        $this->assertTrue((bool) $xSle->is_valuated);
        $this->assertFalse((bool) $ySle->is_valuated, 'baris berdiri sendiri tidak boleh ikut dinilai invoice X');
    }

    // --- aset tetap (Requirement 8) -----------------------------------------

    #[Test]
    public function fixed_asset_listener_handles_receipt_row_without_po_item(): void {
        $item    = Item::find($this->yVariant->item_id);
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, ['quantity' => 2]);

        (new CreateAssetFromPurchase(new AssetService))->handle(new FixedAssetItemApproved($receipt, $row, $item));

        $asset = Asset::where('purchase_receipt_item_id', $row->id)->first();
        $this->assertNotNull($asset, 'Asset tetap terbuat untuk baris di luar PO (tanpa crash).');
        $this->assertEquals(0, $asset->net_purchase_amount);
    }
}
