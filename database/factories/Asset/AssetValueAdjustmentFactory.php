<?php

namespace Database\Factories\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetValueAdjustment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetValueAdjustment>
 */
class AssetValueAdjustmentFactory extends Factory {
    protected $model = AssetValueAdjustment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'                => fake()->unique()->uuid(),
            'asset_id'            => Asset::factory(),
            'date'                => now(),
            'current_asset_value' => 0,
            'new_asset_value'     => 0,
            'revision_number'     => 0,
        ];
    }
}
