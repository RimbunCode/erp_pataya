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
        return [
            'name' => fake()->unique()->words(2, true),
            'type' => fake()->randomElement(['inventory', 'service', 'asset']),
        ];
    }
}
