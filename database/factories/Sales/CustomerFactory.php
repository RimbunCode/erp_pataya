<?php

namespace Database\Factories\Sales;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Sales\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory {
    protected $model = Customer::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name'        => fake()->unique()->company(),
            'email'       => fake()->unique()->safeEmail(),
            'phone'       => fake()->phoneNumber(),
            'vat'         => fake()->bothify('VAT-########'),
            'is_disabled' => false,
            'street'      => fake()->streetAddress(),
            'city'        => fake()->city(),
            'province'    => fake()->state(),
            'zip_code'    => fake()->postcode(),
            'country_id'  => Country::query()->inRandomOrder()->value('code') ?? 'IDN',
        ];
    }

    public function configure(): static {
        return $this->afterCreating(function (Customer $customer): void {
            Branch::query()->create([
                'code'                => fake()->unique()->bothify('CB-##??'),
                'name'                => $customer->name . ' Branch',
                'branchable_type'     => Customer::class,
                'branchable_id'       => $customer->id,
                'is_main_branch'      => false,
                'is_disabled'         => false,
                'billing_address'     => 'same_shipping',
                'shipping_street'     => fake()->streetAddress(),
                'shipping_city'       => fake()->city(),
                'shipping_state'      => fake()->state(),
                'shipping_zip_code'   => fake()->postcode(),
                'shipping_country_id' => $customer->country_id,
            ]);
        });
    }
}
