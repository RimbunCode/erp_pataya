<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\Attribute as InventoryAttribute;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryAttribute>
 */
class AttributeFactory extends Factory {
    protected $model = InventoryAttribute::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $isNumeric = fake()->boolean(30);

        if ($isNumeric) {
            $preset = fake()->randomElement([
                [
                    'name'        => 'Length',
                    'description' => 'Product length in centimeter.',
                    'values'      => ['10', '20', '30', '40'],
                ],
                [
                    'name'        => 'Weight',
                    'description' => 'Net weight in kilogram.',
                    'values'      => ['1', '2', '5', '10'],
                ],
                [
                    'name'        => 'Capacity',
                    'description' => 'Capacity value in liter.',
                    'values'      => ['250', '500', '750', '1000'],
                ],
            ]);
        } else {
            $preset = fake()->randomElement([
                [
                    'name'        => 'Color',
                    'description' => 'Color options for product display.',
                    'values'      => ['Red', 'Blue', 'Black', 'White'],
                ],
                [
                    'name'        => 'Size',
                    'description' => 'Standard size options.',
                    'values'      => ['S', 'M', 'L', 'XL'],
                ],
                [
                    'name'        => 'Material',
                    'description' => 'Primary material composition.',
                    'values'      => ['Steel', 'Plastic', 'Aluminum', 'Wood'],
                ],
            ]);
        }

        return [
            'name'        => $preset['name'] . ' ' . fake()->unique()->numerify('##'),
            'description' => $preset['description'],
            'is_numeric'  => $isNumeric,
            'values'      => collect($preset['values'])
                ->map(fn (string $value): array => ['value' => $value])
                ->all(),
        ];
    }
}
