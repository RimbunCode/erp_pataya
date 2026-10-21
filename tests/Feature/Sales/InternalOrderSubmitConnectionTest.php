<?php

namespace Tests\Feature\Sales;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\Stock;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\User\User;
use App\Services\Sales\InternalOrderService;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InternalOrderSubmitConnectionTest extends TestCase {
    use RefreshDatabase;

    private function makeInternalOrder(): InternalOrder {
        InternalOrder::initPermissions();

        // Kode IO dibentuk FormatingSeries dari @[branch.code], jadi cabang wajib ada.
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);

        return InternalOrder::create([
            'code'          => fake()->unique()->bothify('IO-####'),
            'branch_id'     => $branch->id,
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);
    }

    /**
     * Item IO dengan stok cukup di gudang sumber, supaya submit() lolos validasi stok
     * dan sampai ke pencatatan koneksi.
     */
    private function makeItem(InternalOrder $internalOrder, ?AssetServiceConsumedItem $source = null): InternalOrderItem {
        $itemVariant = ItemVariantFactory::new()->create();
        $warehouse   = WarehouseFactory::new()->create();

        // Stok wajib punya item_unit_id, pola sama dengan InternalOrderSubmitStockValidationMessageTest.
        $unitId     = (string) Str::ulid();
        $itemUnitId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'                => $unitId,
            'code'              => Str::upper(Str::random(6)),
            'name'              => 'Pcs',
            'conversion_factor' => 1,
            'is_default'        => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => $itemVariant->item_id,
            'unit_id'           => $unitId,
            'conversion_factor' => 1,
            'is_default'        => true,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnitId,
            'quantity'          => 100,
            'conversion_factor' => 1,
            'stock_queue'       => [],
        ]);

        return InternalOrderItem::create([
            'internal_order_id'   => $internalOrder->id,
            'item_id'             => $itemVariant->id,
            'quantity'            => 1,
            'conversion_factor'   => 1,
            'source_warehouse_id' => $warehouse->id,
            'referenceable_type'  => $source ? AssetServiceConsumedItem::class : null,
            'referenceable_id'    => $source?->id,
        ]);
    }

    #[Test]
    public function submit_records_item_connection_to_source_consumed_item(): void {
        $consumedItem  = AssetServiceConsumedItem::factory()->create();
        $internalOrder = $this->makeInternalOrder();
        $item          = $this->makeItem($internalOrder, $consumedItem);

        app(InternalOrderService::class)->submit($internalOrder);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetServiceConsumedItem::class)
                ->where('model_id', $consumedItem->id)
                ->where('reference_type', InternalOrderItem::class)
                ->where('reference_id', $item->id)
                ->exists(),
            'Koneksi item tingkat pertama harus tercatat.',
        );
    }

    #[Test]
    public function submit_records_document_level_connection_to_parent_asset_service(): void {
        $consumedItem  = AssetServiceConsumedItem::factory()->create();
        $internalOrder = $this->makeInternalOrder();
        $this->makeItem($internalOrder, $consumedItem);

        app(InternalOrderService::class)->submit($internalOrder);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetService::class)
                ->where('model_id', $consumedItem->asset_service_id)
                ->where('reference_type', InternalOrder::class)
                ->where('reference_id', $internalOrder->id)
                ->exists(),
            'Koneksi tingkat dokumen ke induk (AssetService) harus muncul.',
        );
    }

    #[Test]
    public function submit_writes_no_connection_when_item_has_no_referenceable(): void {
        $internalOrder = $this->makeInternalOrder();
        $this->makeItem($internalOrder);

        app(InternalOrderService::class)->submit($internalOrder);

        $this->assertSame(0, ModelConnection::query()
            ->where('reference_type', InternalOrder::class)
            ->orWhere('reference_type', InternalOrderItem::class)
            ->count());
    }

    #[Test]
    public function submit_twice_does_not_duplicate_connections(): void {
        $consumedItem  = AssetServiceConsumedItem::factory()->create();
        $internalOrder = $this->makeInternalOrder();
        $this->makeItem($internalOrder, $consumedItem);

        $service = app(InternalOrderService::class);
        $service->submit($internalOrder);
        $countAfterFirst = ModelConnection::count();

        $service->submit($internalOrder);

        $this->assertSame($countAfterFirst, ModelConnection::count());
    }
}
