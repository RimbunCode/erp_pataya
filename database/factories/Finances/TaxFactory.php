<?php

namespace Database\Factories\Finances;

use App\Models\Finances\Tax;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tax>
 */
class TaxFactory extends Factory {
    protected $model = Tax::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name' => fake()->unique()->words(2, true),
            'rate' => fake()->randomFloat(2, 0, 15),
        ];
    }
}
