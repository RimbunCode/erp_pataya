<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Item>
 */
class ItemFactory extends Factory {
    protected $model = Item::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code' => fake()->unique()->bothify('ITEM-####'),
            'name' => fake()->words(2, true),
            'type' => 'goods',
        ];
    }
}
