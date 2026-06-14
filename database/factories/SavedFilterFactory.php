<?php

namespace Database\Factories;

use App\Models\Core\ApprovalScheme;
use App\Models\Core\SavedFilter;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavedFilter>
 */
class SavedFilterFactory extends Factory {
    protected $model = SavedFilter::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'user_id'  => User::factory(),
            'model'    => ApprovalScheme::class,
            'name'     => null,
            'is_saved' => false,
            'filter'   => [
                'root' => [
                    'k' => 'and',
                    'c' => [
                        $this->faker->uuid() => ['k' => 'name', 'o' => 'matches', 'v' => 'foo'],
                    ],
                ],
            ],
        ];
    }

    /**
     * Filter ad-hoc yang belum disimpan (default).
     */
    public function ephemeral(): static {
        return $this->state(fn () => ['is_saved' => false, 'name' => null]);
    }

    /**
     * Filter bernama (permanen, milik user).
     */
    public function named(): static {
        return $this->state(fn () => [
            'is_saved' => true,
            'name'     => $this->faker->words(2, true),
        ]);
    }
}
