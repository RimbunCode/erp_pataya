<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
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
            'quantity'         => fake()->randomFloat(2, 1, 10),
            'valuation_rate'   => fake()->randomFloat(2, 1000, 100000),
        ];
    }
}
