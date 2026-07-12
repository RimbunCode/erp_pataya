<?php

namespace Database\Factories\Sales;

use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesOrder>
 */
class SalesOrderFactory extends Factory {
    protected $model = SalesOrder::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'        => fake()->unique()->bothify('SO-####'),
            'date'        => now(),
            'customer_id' => Customer::query()->create([
                'name'        => fake()->unique()->company(),
                'is_disabled' => false,
            ])->id,
            'created_by_id' => User::factory(),
        ];
    }
}
