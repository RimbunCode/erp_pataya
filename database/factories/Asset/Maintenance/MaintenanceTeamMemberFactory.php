<?php

namespace Database\Factories\Asset\Maintenance;

use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use App\Models\Asset\Maintenance\MaintenanceTeamMember;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MaintenanceTeamMember>
 */
class MaintenanceTeamMemberFactory extends Factory {
    protected $model = MaintenanceTeamMember::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'maintenance_team_id' => AssetMaintenanceTeam::factory(),
            'user_id'             => User::factory(),
        ];
    }
}
