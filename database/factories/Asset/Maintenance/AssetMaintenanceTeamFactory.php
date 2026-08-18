<?php

namespace Database\Factories\Asset\Maintenance;

use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetMaintenanceTeam>
 */
class AssetMaintenanceTeamFactory extends Factory {
    protected $model = AssetMaintenanceTeam::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'team_name' => fake()->unique()->company() . ' Maintenance Team',
        ];
    }
}
