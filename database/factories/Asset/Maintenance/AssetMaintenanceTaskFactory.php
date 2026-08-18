<?php

namespace Database\Factories\Asset\Maintenance;

use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetMaintenanceTask>
 */
class AssetMaintenanceTaskFactory extends Factory {
    protected $model = AssetMaintenanceTask::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_maintenance_id' => AssetMaintenance::factory(),
            'task_name'            => fake()->words(3, true),
            'maintenance_type'     => fake()->randomElement(['preventive', 'inspection', 'calibration']),
            'periodicity'          => fake()->randomElement([30, 60, 90, 180, 365]),
            'next_due_date'        => now()->addDays(30),
            'certificate_required' => false,
        ];
    }
}
