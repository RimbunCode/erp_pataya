<?php

namespace Database\Factories\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetDepreciationSchedule>
 */
class AssetDepreciationScheduleFactory extends Factory {
    protected $model = AssetDepreciationSchedule::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_id'                        => Asset::factory(),
            'schedule_date'                   => fake()->dateTimeBetween('now', '+1 year'),
            'depreciation_amount'             => fake()->randomFloat(2, 100, 1000),
            'accumulated_depreciation_amount' => fake()->randomFloat(2, 100, 5000),
        ];
    }
}
