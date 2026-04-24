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
        $entity = fake()->randomElement([
            'item',
            'customer',
            'supplier',
            'purchase-order',
            'sales-order',
            'payment',
            'warehouse',
            'service',
            'approval',
        ]);

        $purpose = fake()->randomElement([
            'urgent',
            'follow-up',
            'revision',
            'audit',
            'ops-check',
            'compliance',
            'vip',
        ]);

        $priority = fake()->randomElement(['low', 'normal', 'high', 'critical']);

        return [
            'name'        => fake()->unique()->bothify("{$entity}-{$purpose}-{$priority}-##"),
            'description' => "Tag for {$entity} records flagged as {$purpose} with {$priority} priority.",
        ];
    }
}
