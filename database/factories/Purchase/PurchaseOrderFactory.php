<?php

namespace Database\Factories\Purchase;

use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrder>
 */
class PurchaseOrderFactory extends Factory {
    protected $model = PurchaseOrder::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'code'        => fake()->unique()->bothify('PO-####'),
            'date'        => now(),
            'supplier_id' => Supplier::query()->create([
                'name'        => fake()->unique()->company(),
                'is_disabled' => false,
            ])->id,
            'created_by_id' => User::factory(),
        ];
    }
}
