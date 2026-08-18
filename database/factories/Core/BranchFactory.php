<?php

namespace Database\Factories\Core;

use App\Models\Core\Branch;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Branch>
 */
class BranchFactory extends Factory {
    protected $model = Branch::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name' => fake()->unique()->city() . ' Branch',
            'code' => fake()->unique()->regexify('[A-Z]{3}'),
        ];
    }
}
