<?php

namespace Database\Factories\Inventory;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warehouse>
 */
class WarehouseFactory extends Factory {
    protected $model = Warehouse::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $warehouseType = fake()->randomElement([
            'Main Warehouse',
            'Transit Warehouse',
            'Return Warehouse',
            'Spare Parts Warehouse',
            'Project Warehouse',
        ]);
        $zone = fake()->randomElement(['North', 'South', 'East', 'West', 'Central']);

        return [
            'branch_id' => $this->resolveBranchId(),
            'name'      => "{$warehouseType} {$zone}",
            'code'      => fake()->unique()->bothify('WH-???-##'),
            'user_id'   => User::query()->inRandomOrder()->value('id'),
        ];
    }

    private function resolveBranchId(): string {
        $branchId = Branch::query()
            ->whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->inRandomOrder()
            ->value('id');

        if ($branchId) {
            return $branchId;
        }

        $countryCode = Country::query()->inRandomOrder()->value('code') ?? 'IDN';

        return Branch::query()->create([
            'code'                => fake()->unique()->bothify('BR-??##'),
            'name'                => fake()->company(),
            'branchable_type'     => null,
            'branchable_id'       => null,
            'is_main_branch'      => false,
            'is_disabled'         => false,
            'billing_address'     => 'same_shipping',
            'shipping_street'     => fake()->streetAddress(),
            'shipping_city'       => fake()->city(),
            'shipping_state'      => fake()->state(),
            'shipping_zip_code'   => fake()->postcode(),
            'shipping_country_id' => $countryCode,
        ])->id;
    }
}
