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
        $segment = fake()->randomElement([
            'Retail',
            'Manufacturing',
            'Construction',
            'Hospitality',
            'Healthcare',
            'Education',
        ]);

        return [
            'name'        => fake()->unique()->company() . " {$segment}",
            'email'       => fake()->unique()->safeEmail(),
            'phone'       => fake()->phoneNumber(),
            'vat'         => fake()->bothify('TAX-##.###.###'),
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
            Branch::query()->updateOrCreate([
                'branchable_type' => Customer::class,
                'branchable_id'   => $customer->id,
                'is_main_branch'  => true,
            ], [
                'code'                => str_replace(' ', '-', $customer->name),
                'name'                => $customer->name,
                'is_disabled'         => false,
                'billing_address'     => 'same_shipping',
                'shipping_street'     => $customer->street,
                'shipping_city'       => $customer->city,
                'shipping_state'      => $customer->province,
                'shipping_zip_code'   => $customer->zip_code,
                'shipping_country_id' => $customer->country_id,
            ]);

            $optionalBranchCount = fake()->numberBetween(0, 2);
            for ($index = 1; $index <= $optionalBranchCount; $index++) {
                $billingAddress    = fake()->randomElement(['same_shipping', 'separate']);
                $isSeparateBilling = $billingAddress === 'separate';
                $branchLabel       = fake()->randomElement(['East', 'West', 'North', 'South', 'Project']);

                Branch::query()->create([
                    'code'                => strtoupper(fake()->bothify("BR{$index}-??##")),
                    'name'                => "{$customer->name} {$branchLabel} Branch",
                    'branchable_type'     => Customer::class,
                    'branchable_id'       => $customer->id,
                    'is_main_branch'      => false,
                    'is_disabled'         => false,
                    'billing_address'     => $billingAddress,
                    'shipping_street'     => fake()->streetAddress(),
                    'shipping_city'       => fake()->city(),
                    'shipping_state'      => fake()->state(),
                    'shipping_zip_code'   => fake()->postcode(),
                    'shipping_country_id' => $customer->country_id,
                    'billing_street'      => $isSeparateBilling ? fake()->streetAddress() : null,
                    'billing_city'        => $isSeparateBilling ? fake()->city() : null,
                    'billing_state'       => $isSeparateBilling ? fake()->state() : null,
                    'billing_zip_code'    => $isSeparateBilling ? fake()->postcode() : null,
                    'billing_country_id'  => $isSeparateBilling ? $customer->country_id : null,
                ]);
            }
        });
    }
}
