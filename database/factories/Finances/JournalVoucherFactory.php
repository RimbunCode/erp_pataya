<?php

namespace Database\Factories\Finances;

use App\Models\Finances\JournalVoucher;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<JournalVoucher>
 */
class JournalVoucherFactory extends Factory {
    protected $model = JournalVoucher::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'          => fake()->unique()->bothify('JVC-####'),
            'date'          => now(),
            'description'   => fake()->sentence(),
            'created_by_id' => User::factory(),
        ];
    }
}
