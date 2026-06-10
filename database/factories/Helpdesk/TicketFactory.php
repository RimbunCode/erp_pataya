<?php

namespace Database\Factories\Helpdesk;

use App\Models\Helpdesk\Ticket;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ticket>
 */
class TicketFactory extends Factory {
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'          => fake()->unique()->bothify('TKT-####'),
            'type'          => fake()->randomElement(['bug_problem', 'task', 'question', 'other']),
            'priority'      => fake()->randomElement(['low', 'medium', 'high', 'critical']),
            'subject'       => fake()->sentence(5),
            'content'       => '<p>' . fake()->paragraph() . '</p>',
            'status'        => 'new',
            'progress'      => 0,
            'assign_to_id'  => null,
            'created_by_id' => User::factory(),
            'start_date'    => now(),
        ];
    }
}
