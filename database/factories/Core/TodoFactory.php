<?php

namespace Database\Factories\Core;

use App\Models\Core\Todo;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Todo>
 */
class TodoFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'reference_type'    => User::class,
            'reference_id'      => User::factory(),
            'allocated_to_id'   => User::factory(),
            'allocated_to_type' => 'user',
            'assigned_by_id'    => User::factory(),
            'description'       => fake()->sentence(6),
            'priority'          => fake()->randomElement(['low', 'medium', 'high']),
            'status'            => 'open',
            'date'              => now(),
        ];
    }
}
