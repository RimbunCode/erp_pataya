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
        $values = $isNumeric
            ? collect(range(1, fake()->numberBetween(3, 6)))->map(fn (int $value): array => ['value' => (string) $value])->all()
            : collect(range(1, fake()->numberBetween(3, 6)))->map(fn (int $index): array => ['value' => fake()->unique()->word() . $index])->all();

        return [
            'name'        => fake()->unique()->words(2, true),
            'description' => fake()->optional()->sentence(),
            'is_numeric'  => $isNumeric,
            'values'      => $values,
        ];
    }
}
