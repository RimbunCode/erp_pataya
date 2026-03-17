<?php

namespace Database\Factories\Core;

use App\Models\Core\Tag;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tag>
 */
class TagFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name' => $this->faker->unique()->word(),
        ];
    }
}
