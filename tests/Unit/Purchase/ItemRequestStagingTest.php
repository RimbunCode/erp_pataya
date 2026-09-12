<?php

namespace Tests\Unit\Purchase;

use App\Enums\FormStatus;
use App\Models\Asset\AssetService;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\ItemRequestCoverage;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use App\Services\Purchase\ItemRequestService;
use App\Services\Purchase\PurchaseOrderService;
use App\Services\Purchase\PurchaseRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * spec item-request-auto-detect — Requirement 3 (staging/prefill), 4.1/4.6
 * (coverage recording). Property 2 (baris hilang setelah fully covered)
 * divalidasi lewat alur penuh store() PurchaseRequest/PurchaseOrder.
 */
class ItemRequestStagingTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([SalesOrder::class, PurchaseRequest::class, PurchaseOrder::class, AssetService::class] as $model) {
            $model::initPermissions();
        }
    }

    private function service(): ItemRequestService {
        return app(ItemRequestService::class);
    }

    private function ensureItemUnit(ItemVariant $variant): ItemUnit {
        $item = Item::find($variant->item_id);
        $unit = Unit::create([
            'code'              => 'PCS-' . uniqid(),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        return ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
    }

    private function makeWarehouse(): Warehouse {
        $branch = Branch::create(['name' => 'Staging Branch ' . uniqid(), 'code' => strtoupper(uniqid())]);

        return Warehouse::create(['branch_id' => $branch->id, 'name' => 'Staging Warehouse', 'code' => 'WH-' . uniqid()]);
    }

    private function makeShortageSalesOrderItem(float $quantity = 10, float $stockQuantity = 0): SalesOrderItem {
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $itemUnit  = $this->ensureItemUnit($variant);
        Stock::create([
            'item_variant_id'   => $variant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => $stockQuantity,
            'conversion_factor' => 1,
            'stock_queue'       => $stockQuantity > 0 ? [['rate' => 0, 'quantity' => $stockQuantity, 'is_valuated' => true]] : [],
        ]);

        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Staging Test Customer ' . uniqid(), 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
            'status'        => [FormStatus::DRAFT],
        ]);

        return SalesOrderItem::create([
            'sales_order_id'      => $salesOrder->id,
            'item_id'             => $variant->id,
            'item_unit_id'        => $itemUnit->id,
            'source_warehouse_id' => $warehouse->id,
            'quantity'            => $quantity,
            'price'               => 0,
        ]);
    }

    #[Test]
    public function stage_batch_then_resolve_batch_produces_prefill_items_and_is_single_use(): void {
        $item = $this->makeShortageSalesOrderItem(quantity: 10);

        $token = $this->service()->stageBatch([
            ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 6],
        ]);

        $resolved = $this->service()->resolveBatch($token);

        $this->assertCount(1, $resolved);
        $this->assertEqualsWithDelta(6.0, $resolved[0]['quantity'], 0.0001);
        $this->assertSame(SalesOrderItem::class, $resolved[0]['referenceable_type']);
        $this->assertSame($item->id, $resolved[0]['referenceable_id']);
        $this->assertTrue($item->item->is($resolved[0]['item']));
        $this->assertNotNull($resolved[0]['unit']);

        // Single-use: token yang sama dipanggil lagi -> kosong.
        $this->assertSame([], $this->service()->resolveBatch($token));
    }

    #[Test]
    public function stage_batch_clamps_quantity_to_the_current_shortage(): void {
        $item = $this->makeShortageSalesOrderItem(quantity: 10, stockQuantity: 7);
        // shortage_quantity = 10 - 7 = 3, tapi user minta 100 (race condition/tampering).

        $token = $this->service()->stageBatch([
            ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 100],
        ]);
        $resolved = $this->service()->resolveBatch($token);

        $this->assertCount(1, $resolved);
        $this->assertEqualsWithDelta(3.0, $resolved[0]['quantity'], 0.0001);
    }

    #[Test]
    public function stage_batch_skips_a_selection_that_is_no_longer_short(): void {
        $item = $this->makeShortageSalesOrderItem(quantity: 10, stockQuantity: 10);
        // shortage_quantity = 0 -> baris ini sudah tidak muncul di getShortageRows().

        $token = $this->service()->stageBatch([
            ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 5],
        ]);
        $resolved = $this->service()->resolveBatch($token);

        $this->assertSame([], $resolved);
    }

    #[Test]
    public function resolve_batch_with_unknown_token_returns_empty_array(): void {
        $this->assertSame([], $this->service()->resolveBatch((string) Str::ulid()));
    }

    #[Test]
    public function creating_a_purchase_request_from_a_prefilled_item_records_coverage_and_row_disappears(): void {
        // Property 2, end-to-end lewat PurchaseRequestService::create() sungguhan
        // (bukan ItemRequestCoverage::create() langsung) -- membuktikan wiring
        // Task 5.3 benar2 terpasang.
        $item = $this->makeShortageSalesOrderItem(quantity: 10);
        $this->assertCount(1, $this->service()->getShortageRows());

        $units           = $this->ensureItemUnit($item->item);
        $branch          = Branch::create(['name' => 'PR Test Branch', 'code' => 'PRB']);
        $purchaseRequest = app(PurchaseRequestService::class)->create([
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
            'branch_id'     => $branch->id,
            'branch'        => ['code' => $branch->code, 'name' => $branch->name],
            'items'         => [
                [
                    'id'                 => 'new',
                    'item'               => ['id' => $item->item_id, 'code' => $item->item->code],
                    'unit'               => ['id' => $units->id, 'name' => 'Pieces'],
                    'quantity'           => 10,
                    'referenceable_type' => SalesOrderItem::class,
                    'referenceable_id'   => $item->id,
                ],
            ],
        ]);

        $this->assertSame(1, ItemRequestCoverage::where('source_id', $item->id)->count());
        // Feedback user: PR masih draft -> belum dianggap komitmen nyata,
        // baris shortage TETAP tampil sampai PR disubmit.
        $this->assertCount(1, $this->service()->getShortageRows());

        $purchaseRequest->update(['status' => [FormStatus::SUBMITTED]]);
        $this->assertCount(0, $this->service()->getShortageRows());
    }

    #[Test]
    public function creating_a_purchase_order_from_a_prefilled_item_records_coverage(): void {
        $item = $this->makeShortageSalesOrderItem(quantity: 10);

        $country = Country::create(['code' => 'IST', 'name' => 'Item Staging Country', 'lang_code' => 'en']);

        // Supplier::create() Eloquent gagal di seluruh codebase ini (bug
        // pre-existing tak terkait spec ini): model pakai trait TreeView
        // (butuh kolom lft/rgt/depth) tapi migration create_suppliers_table
        // tidak pernah menambah kolom itu. Insert mentah lewat query builder
        // sebagai workaround supaya test PurchaseOrder tetap bisa jalan.
        $supplierId = (string) Str::ulid();
        DB::table('suppliers')->insert([
            'id'         => $supplierId,
            'name'       => 'Item Staging Supplier',
            'country_id' => $country->code,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $units  = $this->ensureItemUnit($item->item);
        $branch = Branch::create(['name' => 'PO Test Branch', 'code' => 'POB']);

        app(PurchaseOrderService::class)->create([
            'supplier'      => ['id' => $supplierId],
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
            'branch_id'     => $branch->id,
            'branch'        => ['code' => $branch->code, 'name' => $branch->name],
            'items'         => [
                [
                    'id'                 => 'new',
                    'item'               => ['id' => $item->item_id],
                    'unit'               => ['id' => $units->id],
                    'target_warehouse'   => ['id' => $item->source_warehouse_id],
                    'quantity'           => 10,
                    'rate'               => 0,
                    'referenceable_type' => SalesOrderItem::class,
                    'referenceable_id'   => $item->id,
                ],
            ],
        ]);

        $this->assertSame(1, ItemRequestCoverage::where('source_id', $item->id)
            ->where('covering_type', PurchaseOrderItem::class)
            ->count());
    }
}
