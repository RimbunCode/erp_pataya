<?php

namespace Database\Factories\Purchase;

use App\Models\Purchase\PurchaseOrder;
use App\Models\User\User;
use Database\Factories\Core\CountryFactory;
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
            'code'          => fake()->unique()->bothify('PO-####'),
            'date'          => now(),
            'supplier_id'   => SupplierFactory::new()->create(['country_id' => CountryFactory::new()->create()->code])->id,
            'created_by_id' => User::factory(),
        ];
    }
}
