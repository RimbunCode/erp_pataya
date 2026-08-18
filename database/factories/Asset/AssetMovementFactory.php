<?php

namespace Database\Factories\Asset;

use App\Enums\AssetMovementPurpose;
use App\Models\Asset\AssetMovement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetMovement>
 */
class AssetMovementFactory extends Factory {
    protected $model = AssetMovement::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'             => fake()->unique()->uuid(),
            'purpose'          => AssetMovementPurpose::TRANSFER,
            'transaction_date' => now(),
            'revision_number'  => 0,
        ];
    }
}
