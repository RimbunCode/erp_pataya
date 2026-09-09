<?php

namespace Database\Factories\Asset;

use App\Enums\AssetOwnershipType;
use App\Enums\AssetType;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Asset>
 */
class AssetFactory extends Factory {
    protected $model = Asset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_name'                             => fake()->word() . ' ' . fake()->unique()->numerify('###'),
            'code'                                   => fake()->unique()->uuid(),
            'asset_category_id'                      => AssetCategory::factory(),
            'asset_location_id'                      => AssetLocation::factory(),
            'asset_type'                             => AssetType::EXISTING_ASSET,
            'asset_quantity'                         => 1,
            'is_rentable'                            => false,
            'allow_bulk_quantity'                    => false,
            'ownership_type'                         => AssetOwnershipType::COMPANY,
            'calculate_depreciation'                 => false,
            'is_depreciable'                         => false,
            'net_purchase_amount'                    => 0,
            'gross_purchase_amount'                  => 0,
            'additional_asset_cost'                  => 0,
            'opening_accumulated_depreciation'       => 0,
            'opening_number_of_booked_depreciations' => 0,
            'revision_number'                        => 0,
            'maintenance_required'                   => false,
            'daily_prorata_based'                    => false,
        ];
    }

    public function companyOwned(): static {
        return $this->state(fn (array $attributes) => [
            'ownership_type' => AssetOwnershipType::COMPANY,
        ]);
    }

    public function supplierOwned(): static {
        return $this->state(fn (array $attributes) => [
            'ownership_type'        => AssetOwnershipType::SUPPLIER,
            'ownership_supplier_id' => (string) Str::ulid(),
        ]);
    }

    public function customerOwned(): static {
        return $this->state(fn (array $attributes) => [
            'ownership_type'        => AssetOwnershipType::CUSTOMER,
            'ownership_customer_id' => (string) Str::ulid(),
        ]);
    }

    public function rentable(): static {
        return $this->state(fn (array $attributes) => [
            'is_rentable' => true,
        ]);
    }

    public function bulkQuantity(): static {
        return $this->state(fn (array $attributes) => [
            'allow_bulk_quantity' => true,
        ]);
    }
}
