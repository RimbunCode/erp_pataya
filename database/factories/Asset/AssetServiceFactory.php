<?php

namespace Database\Factories\Asset;

use App\Enums\AssetServiceType;
use App\Models\Asset\AssetService;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetService>
 */
class AssetServiceFactory extends Factory {
    protected $model = AssetService::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'            => fake()->unique()->uuid(),
            'type'            => AssetServiceType::REPAIR,
            'revision_number' => 0,
            'failure_date'    => now(),
            'description'     => fake()->sentence(),
        ];
    }
}
