<?php

namespace Database\Factories\Purchase;

use App\Models\Purchase\ItemRequestCoverage;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ItemRequestCoverage>
 */
class ItemRequestCoverageFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'quantity_covered' => $this->faker->randomFloat(2, 1, 100),
            'created_by_id'    => User::factory(),
        ];
    }
}
