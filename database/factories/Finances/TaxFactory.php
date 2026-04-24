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
        $tax = fake()->randomElement([
            ['name' => 'VAT Standard', 'rate' => 11.00],
            ['name' => 'Withholding Tax Art 23', 'rate' => 2.00],
            ['name' => 'Service Tax', 'rate' => 5.00],
            ['name' => 'Import Tax', 'rate' => 7.50],
            ['name' => 'Luxury Goods Tax', 'rate' => 10.00],
        ]);

        return [
            'name' => $tax['name'] . ' ' . fake()->unique()->numerify('##'),
            'rate' => $tax['rate'],
        ];
    }
}
