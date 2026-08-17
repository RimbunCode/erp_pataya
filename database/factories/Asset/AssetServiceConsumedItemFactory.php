<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetServiceConsumedItem>
 */
class AssetServiceConsumedItemFactory extends Factory {
    protected $model = AssetServiceConsumedItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_service_id' => AssetService::factory(),
            'item_id'          => Item::factory(),
            'item_unit_id'     => function (array $attributes) {
                return $this->makeItemUnit($attributes['item_id']);
            },
            'quantity'       => fake()->randomFloat(2, 1, 10),
            'valuation_rate' => fake()->randomFloat(2, 1000, 100000),
        ];
    }

    /**
     * Item::defaultUom() mencocokkan ItemUnit.unit_id == Item.default_unit_id
     * — ItemFactory tidak otomatis mengisi default_unit_id, jadi factory ini
     * membuat Unit + ItemUnit lalu mengaitkannya ke Item secara eksplisit
     * (production selalu terisi lewat alur create Item normal).
     */
    private function makeItemUnit(mixed $itemId): string {
        $item = $itemId instanceof Item ? $itemId : Item::find($itemId);

        $unit = Unit::create([
            'code'              => 'PCS-' . fake()->unique()->numerify('#####'),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $item->update(['default_unit_id' => $unit->id]);

        return $itemUnit->id;
    }
}
