<?php

namespace Tests\Unit\Purchase;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetLocation;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\ItemRequestCoverage;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Sales\Customer;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use App\Services\Purchase\ItemRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * spec item-request-auto-detect — Requirement 1 (deteksi), 1.5 (exclusion
 * AssetService), 2 (filter), 4 (covered quantity). Property 1 & 4 di
 * design.md divalidasi di sini.
 */
class ItemRequestServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([SalesOrder::class, InternalOrder::class, PurchaseRequest::class, AssetService::class] as $model) {
            $model::initPermissions();
        }
    }

    private function service(): ItemRequestService {
        return app(ItemRequestService::class);
    }

    private function makeWarehouse(?Branch $branch = null): Warehouse {
        $branch ??= Branch::create(['name' => 'Test Branch ' . uniqid(), 'code' => strtoupper(uniqid())]);

        return Warehouse::create([
            'branch_id' => $branch->id,
            'name'      => 'Test Warehouse',
            'code'      => 'WH-' . uniqid(),
        ]);
    }

    /**
     * ItemFactory tidak otomatis mengisi default_unit_id (lihat komentar
     * AssetServiceConsumedItemFactory), jadi ItemUnit dibuat manual di sini
     * — sama seperti pola factory itu.
     */
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

    private function makeStock(ItemVariant $variant, Warehouse $warehouse, float $actualQuantity, float $reservedQuantity = 0): Stock {
        return Stock::create([
            'item_variant_id'   => $variant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $this->ensureItemUnit($variant)->id,
            'quantity'          => $actualQuantity,
            'reserved_quantity' => $reservedQuantity,
            'conversion_factor' => 1,
            'stock_queue'       => $actualQuantity > 0 ? [['rate' => 0, 'quantity' => $actualQuantity, 'is_valuated' => true]] : [],
        ]);
    }

    private function makeSalesOrder(array $status = [FormStatus::DRAFT], ?Branch $branch = null): SalesOrder {
        return SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Item Request Test Customer ' . uniqid(), 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
            'status'        => $status,
            'branch_id'     => $branch?->id,
        ]);
    }

    private function makeSalesOrderItem(SalesOrder $salesOrder, ItemVariant $variant, Warehouse $warehouse, float $quantity, ?string $referenceableType = null, ?string $referenceableId = null): SalesOrderItem {
        return SalesOrderItem::create([
            'sales_order_id'      => $salesOrder->id,
            'item_id'             => $variant->id,
            'source_warehouse_id' => $warehouse->id,
            'quantity'            => $quantity,
            'price'               => 0,
            'referenceable_type'  => $referenceableType,
            'referenceable_id'    => $referenceableId,
        ]);
    }

    #[Test]
    public function detects_shortage_from_a_draft_sales_order_item_with_insufficient_stock(): void {
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 3);

        $salesOrder = $this->makeSalesOrder();
        $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 10);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(7.0, $rows->first()['shortage_quantity'], 0.0001);
        $this->assertSame(ItemRequestService::SOURCE_SALES_ORDER, $rows->first()['source_label']);
        $this->assertSame($salesOrder->id, $rows->first()['source_document']['id']);
        $this->assertSame($salesOrder->code, $rows->first()['source_document']['code']);
        $this->assertSame(SalesOrder::class, $rows->first()['source_document']['thisModel']);
        $this->assertSame('salesOrders', $rows->first()['source_document']['route']);

        // Feedback user: pola linkable+permission-gated berlaku ke SEMUA kolom
        // relasi (Item, Warehouse), bukan cuma Source.
        $this->assertSame($variant->id, $rows->first()['item_document']['id']);
        $this->assertSame(ItemVariant::class, $rows->first()['item_document']['thisModel']);
        $this->assertSame('itemVariants', $rows->first()['item_document']['route']);
        $this->assertSame($warehouse->id, $rows->first()['warehouse_documents'][0]['id']);
        $this->assertSame(Warehouse::class, $rows->first()['warehouse_documents'][0]['thisModel']);
        $this->assertSame('warehouses', $rows->first()['warehouse_documents'][0]['route']);
    }

    #[Test]
    public function does_not_detect_a_submitted_sales_order_item_even_if_stock_is_insufficient(): void {
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 1);

        $salesOrder = $this->makeSalesOrder(status: [FormStatus::SUBMITTED]);
        $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 10);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(0, $rows);
    }

    #[Test]
    public function does_not_report_negative_shortage_when_stock_is_sufficient(): void {
        // Property 1: shortage_quantity never negative.
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 100);

        $salesOrder = $this->makeSalesOrder();
        $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 10);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(0, $rows);
    }

    #[Test]
    public function excludes_sales_order_items_referencing_asset_service(): void {
        // Property 4: tidak ada double-count AssetService.
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 0);

        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);
        $salesOrder   = $this->makeSalesOrder();
        $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 5, referenceableType: AssetService::class, referenceableId: $assetService->id);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(0, $rows);
    }

    #[Test]
    public function detects_shortage_from_an_active_asset_service_consumed_item_via_resolved_asset_branch(): void {
        $branch    = Branch::create(['name' => 'AssetService Branch', 'code' => 'ASB']);
        $warehouse = $this->makeWarehouse($branch);
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 2);

        $asset = Asset::factory()->create([
            'asset_location_id' => AssetLocation::factory()->create(['branch_id' => $branch->id])->id,
        ]);
        $assetService = AssetService::factory()->create([
            'asset_id' => $asset->id,
            'type'     => AssetServiceType::REPAIR,
            'status'   => [FormStatus::APPROVED],
        ]);
        AssetServiceConsumedItem::create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $variant->id,
            'item_unit_id'     => $this->ensureItemUnit($variant)->id,
            'quantity'         => 5,
            'valuation_rate'   => 0,
        ]);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(3.0, $rows->first()['shortage_quantity'], 0.0001);
        $this->assertSame(ItemRequestService::SOURCE_ASSET_SERVICE, $rows->first()['source_label']);
        $this->assertSame($assetService->id, $rows->first()['source_document']['id']);
        $this->assertSame($assetService->code, $rows->first()['source_document']['code']);
        $this->assertSame(AssetService::class, $rows->first()['source_document']['thisModel']);
        $this->assertSame('assetServices', $rows->first()['source_document']['route']);

        $this->assertSame($branch->id, $rows->first()['branch_document']['id']);
        $this->assertSame(Branch::class, $rows->first()['branch_document']['thisModel']);
        $this->assertSame('branches', $rows->first()['branch_document']['route']);
        $this->assertSame($warehouse->id, $rows->first()['warehouse_documents'][0]['id']);
        $this->assertSame(Warehouse::class, $rows->first()['warehouse_documents'][0]['thisModel']);
        $this->assertSame('warehouses', $rows->first()['warehouse_documents'][0]['route']);
    }

    #[Test]
    public function excludes_consumed_items_from_a_completed_asset_service(): void {
        $branch    = Branch::create(['name' => 'AssetService Branch 2', 'code' => 'AS2']);
        $warehouse = $this->makeWarehouse($branch);
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 0);

        $asset = Asset::factory()->create([
            'asset_location_id' => AssetLocation::factory()->create(['branch_id' => $branch->id])->id,
        ]);
        $assetService = AssetService::factory()->create([
            'asset_id' => $asset->id,
            'type'     => AssetServiceType::REPAIR,
            'status'   => [FormStatus::COMPLETED],
        ]);
        AssetServiceConsumedItem::create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $variant->id,
            'item_unit_id'     => $this->ensureItemUnit($variant)->id,
            'quantity'         => 5,
            'valuation_rate'   => 0,
        ]);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(0, $rows);
    }

    #[Test]
    public function active_coverage_reduces_shortage_and_fully_covered_row_disappears(): void {
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 0);

        $salesOrder = $this->makeSalesOrder();
        $item       = $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 10);

        $purchaseRequest = PurchaseRequest::create([
            'code'          => 'PR-TEST-' . uniqid(),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
            'status'        => [FormStatus::SUBMITTED],
        ]);
        $coveringItem = PurchaseRequestItem::create([
            'purchase_request_id' => $purchaseRequest->id,
            'item_variant_id'     => $variant->id,
            'quantity'            => 6,
        ]);
        ItemRequestCoverage::factory()
            ->for($item, 'source')
            ->for($coveringItem, 'covering')
            ->create(['quantity_covered' => 6]);

        $rows = $this->service()->getShortageRows();
        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(4.0, $rows->first()['shortage_quantity'], 0.0001);

        // Cover sisanya -> baris hilang total (Property 2).
        ItemRequestCoverage::factory()
            ->for($item, 'source')
            ->for($coveringItem, 'covering')
            ->create(['quantity_covered' => 4]);

        $rows = $this->service()->getShortageRows();
        $this->assertCount(0, $rows);
    }

    #[Test]
    public function coverage_from_a_draft_purchase_request_is_ignored(): void {
        // Feedback user: PR/PO masih draft belum dianggap komitmen nyata --
        // baris shortage harus tetap tampil penuh sampai dokumen disubmit.
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 0);

        $salesOrder = $this->makeSalesOrder();
        $item       = $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 10);

        $purchaseRequest = PurchaseRequest::create([
            'code'          => 'PR-TEST-' . uniqid(),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
            'status'        => [FormStatus::DRAFT],
        ]);
        $coveringItem = PurchaseRequestItem::create([
            'purchase_request_id' => $purchaseRequest->id,
            'item_variant_id'     => $variant->id,
            'quantity'            => 10,
        ]);
        ItemRequestCoverage::factory()
            ->for($item, 'source')
            ->for($coveringItem, 'covering')
            ->create(['quantity_covered' => 10]);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(10.0, $rows->first()['shortage_quantity'], 0.0001);
    }

    #[Test]
    public function coverage_from_a_canceled_purchase_request_is_ignored(): void {
        $warehouse = $this->makeWarehouse();
        $variant   = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouse, actualQuantity: 0);

        $salesOrder = $this->makeSalesOrder();
        $item       = $this->makeSalesOrderItem($salesOrder, $variant, $warehouse, quantity: 10);

        $purchaseRequest = PurchaseRequest::create([
            'code'          => 'PR-TEST-' . uniqid(),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
            'status'        => [FormStatus::CANCELED],
        ]);
        $coveringItem = PurchaseRequestItem::create([
            'purchase_request_id' => $purchaseRequest->id,
            'item_variant_id'     => $variant->id,
            'quantity'            => 10,
        ]);
        ItemRequestCoverage::factory()
            ->for($item, 'source')
            ->for($coveringItem, 'covering')
            ->create(['quantity_covered' => 10]);

        $rows = $this->service()->getShortageRows();

        $this->assertCount(1, $rows);
        $this->assertEqualsWithDelta(10.0, $rows->first()['shortage_quantity'], 0.0001);
    }

    #[Test]
    public function filters_by_warehouse_branch_and_source_type(): void {
        $branchA    = Branch::create(['name' => 'Branch A', 'code' => 'BRA']);
        $branchB    = Branch::create(['name' => 'Branch B', 'code' => 'BRB']);
        $warehouseA = $this->makeWarehouse($branchA);
        $warehouseB = $this->makeWarehouse($branchB);
        $variant    = ItemVariant::factory()->create();
        $this->makeStock($variant, $warehouseA, actualQuantity: 0);
        $this->makeStock($variant, $warehouseB, actualQuantity: 0);

        $salesOrderA = $this->makeSalesOrder(branch: $branchA);
        $this->makeSalesOrderItem($salesOrderA, $variant, $warehouseA, quantity: 5);
        $salesOrderB = $this->makeSalesOrder(branch: $branchB);
        $this->makeSalesOrderItem($salesOrderB, $variant, $warehouseB, quantity: 5);

        $byWarehouse = $this->service()->getShortageRows(['warehouse_ids' => [$warehouseA->id]]);
        $this->assertCount(1, $byWarehouse);

        $byBranch = $this->service()->getShortageRows(['branch_ids' => [$branchB->id]]);
        $this->assertCount(1, $byBranch);

        $byWrongSourceType = $this->service()->getShortageRows(['source_types' => [ItemRequestService::SOURCE_ASSET_SERVICE]]);
        $this->assertCount(0, $byWrongSourceType);

        $bySalesOrderType = $this->service()->getShortageRows(['source_types' => [ItemRequestService::SOURCE_SALES_ORDER]]);
        $this->assertCount(2, $bySalesOrderType);
    }
}
