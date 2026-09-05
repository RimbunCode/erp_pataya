<?php

namespace Tests\Unit;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Services\Asset\AssetServiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceServiceConsumedItemUnitTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        AssetService::initPermissions();
    }

    /**
     * Requirement 4.5, spec asset-service-billing: FE kirim ItemVariant
     * (bukan Item langsung) sejak AssetServiceConsumedItem.item_id direwire
     * ke ItemVariant — lihat Asset/Services/Form.jsx.
     */
    private function makeItemWithUnit(): array {
        $item        = Item::factory()->create();
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id]);
        $unit        = Unit::create([
            'code'              => 'U-' . fake()->unique()->numerify('#####'),
            'name'              => 'Test Unit',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        return [$itemVariant, $itemUnit];
    }

    #[Test]
    public function create_fills_item_unit_id_from_nested_fe_payload(): void {
        [$item, $itemUnit] = $this->makeItemWithUnit();

        $assetService = (new AssetServiceService)->create([
            'type'          => 'repair',
            'consumedItems' => [
                [
                    'item'           => ['id' => $item->id],
                    'unit'           => ['id' => $itemUnit->id],
                    'quantity'       => 3,
                    'valuation_rate' => 1000,
                ],
            ],
        ]);

        $consumedItem = AssetServiceConsumedItem::where('asset_service_id', $assetService->id)->first();

        $this->assertNotNull($consumedItem);
        $this->assertSame($item->id, $consumedItem->item_id);
        $this->assertSame($itemUnit->id, $consumedItem->item_unit_id);
    }

    #[Test]
    public function update_fills_item_unit_id_for_existing_consumed_item(): void {
        [$item, $itemUnit]   = $this->makeItemWithUnit();
        [$item2, $itemUnit2] = $this->makeItemWithUnit();

        $assetService = AssetService::factory()->create();
        $consumedItem = AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $item->id,
            'item_unit_id'     => $itemUnit->id,
            'quantity'         => 1,
            'valuation_rate'   => 500,
        ]);

        (new AssetServiceService)->update($assetService, [
            'consumedItems' => [
                [
                    'id'             => $consumedItem->id,
                    'item'           => ['id' => $item2->id],
                    'unit'           => ['id' => $itemUnit2->id],
                    'quantity'       => 7,
                    'valuation_rate' => 2000,
                ],
            ],
        ]);

        $consumedItem->refresh();

        $this->assertSame($item2->id, $consumedItem->item_id);
        $this->assertSame($itemUnit2->id, $consumedItem->item_unit_id);
        $this->assertEqualsWithDelta(7.0, (float) $consumedItem->quantity, 0.001);
    }
}
