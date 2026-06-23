<?php

namespace Database\Factories\Core;

use App\Models\Core\Currency;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Currency>
 */
class CurrencyFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'          => strtoupper(fake()->unique()->lexify('???')),
            'name'          => fake()->word() . ' currency',
            'symbol'        => fake()->randomElement(['$', '€', '£', '¥', 'Rp']),
            'number_format' => '#,###.##',
        ];
    }
}
