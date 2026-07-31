<?php

namespace Database\Factories\Core;

use App\Enums\TodoType;
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
            'code'              => fake()->unique()->bothify('TODO/##-##/####'),
            'reference_type'    => User::class,
            'reference_id'      => User::factory(),
            'allocated_to_id'   => User::factory(),
            'allocated_to_type' => 'user',
            'assigned_by_id'    => User::factory(),
            'type'              => TodoType::TASK->value,
            'description'       => fake()->sentence(6),
            'priority'          => fake()->randomElement(['low', 'medium', 'high']),
            'status'            => 'open',
            'date'              => now(),
        ];
    }

    /**
     * due_date N hari dari sekarang (di masa depan).
     */
    public function dueIn(int $days): static {
        return $this->state(fn () => [
            'due_date' => now()->addDays($days),
        ]);
    }

    /**
     * due_date N hari yang lalu (sudah lewat tenggat).
     */
    public function overdue(int $days): static {
        return $this->state(fn () => [
            'due_date' => now()->subDays($days),
        ]);
    }
}
