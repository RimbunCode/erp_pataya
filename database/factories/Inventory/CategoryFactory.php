<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory {
    protected $model = Category::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $type         = fake()->randomElement(['inventory', 'service', 'vehicle']);
        $categoryName = match ($type) {
            'inventory' => fake()->randomElement([
                'Raw Material',
                'Finished Goods',
                'Packaging',
                'Spare Parts',
                'Consumables',
            ]),
            'service' => fake()->randomElement([
                'Installation Service',
                'Maintenance Service',
                'Consulting Service',
                'Delivery Service',
            ]),
            default => fake()->randomElement([
                'Operational Vehicle',
                'Project Vehicle',
                'Field Vehicle',
                'Transport Vehicle',
            ]),
        };

        return [
            'name' => $categoryName . ' ' . fake()->unique()->numerify('##'),
            'type' => $type,
        ];
    }
}
