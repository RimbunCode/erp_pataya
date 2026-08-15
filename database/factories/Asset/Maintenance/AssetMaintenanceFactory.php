<?php

namespace Database\Factories\Asset\Maintenance;

use App\Models\Asset\Asset;
use App\Models\Asset\Maintenance\AssetMaintenance;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetMaintenance>
 */
class AssetMaintenanceFactory extends Factory {
    protected $model = AssetMaintenance::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_id' => Asset::factory(),
        ];
    }
}
