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
        $domain = fake()->randomElement([
            'inventory',
            'sales',
            'purchase',
            'finance',
            'warehouse',
            'customer',
            'supplier',
            'service',
            'approval',
        ]);

        $context = fake()->randomElement([
            'priority',
            'follow-up',
            'revision',
            'audit',
            'ops',
            'schedule',
            'compliance',
        ]);

        $status = fake()->randomElement([
            'draft',
            'pending',
            'active',
            'done',
            'overdue',
            'internal',
            'external',
        ]);

        return [
            'name'        => fake()->unique()->bothify("{$domain}-{$context}-{$status}-##"),
            'description' => fake()->sentence(),
        ];
    }
}
