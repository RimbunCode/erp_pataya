<?php

namespace Database\Factories\Finances;

use App\Models\Finances\SalesInvoice;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesInvoice>
 */
class SalesInvoiceFactory extends Factory {
    protected $model = SalesInvoice::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        SalesInvoice::initPermissions();

        return [
            'code'          => fake()->unique()->bothify('SI-####'),
            'date'          => now(),
            'created_by_id' => User::factory(),
        ];
    }
}
