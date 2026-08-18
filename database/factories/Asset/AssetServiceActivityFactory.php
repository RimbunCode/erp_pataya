<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetServiceActivity>
 */
class AssetServiceActivityFactory extends Factory {
    protected $model = AssetServiceActivity::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_service_id' => AssetService::factory(),
            'action_date'      => now(),
            'description'      => fake()->sentence(),
            'is_done'          => false,
        ];
    }
}
