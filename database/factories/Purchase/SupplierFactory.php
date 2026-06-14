<?php

namespace Database\Factories\Purchase;

use App\Models\Core\Country;
use App\Models\Purchase\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory {
    protected $model = Supplier::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $supplierType = fake()->randomElement([
            'Raw Material',
            'Packaging',
            'Logistics',
            'Equipment',
            'Maintenance',
        ]);
        $bankName = fake()->randomElement([
            'Bank Mandiri',
            'Bank BCA',
            'Bank BRI',
            'Bank BNI',
            'Bank CIMB',
        ]);

        return [
            'name'  => fake()->unique()->company() . " {$supplierType} Supplier",
            'phone' => fake()->phoneNumber(),
            'email' => fake()->unique()->safeEmail(),
            'banks' => [
                [
                    'bank'    => $bankName,
                    'no_acc'  => (string) fake()->numberBetween(1000000, 9999999),
                    'account' => fake()->company() . ' Operating',
                ],
            ],
            'street'      => fake()->streetAddress(),
            'city'        => fake()->city(),
            'province'    => fake()->state(),
            'zip_code'    => fake()->postcode(),
            'country_id'  => Country::query()->inRandomOrder()->value('code') ?? 'IDN',
            'is_disabled' => false,
            'parent_id'   => null,
        ];
    }
}
