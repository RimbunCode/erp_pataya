<?php

namespace Tests\Unit\Asset\Maintenance;

use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use App\Models\Asset\Maintenance\MaintenanceTeamMember;
use App\Models\Core\Branch;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMaintenanceTeamTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function members_returns_has_many_relation(): void {
        $team = new AssetMaintenanceTeam;

        $this->assertInstanceOf(HasMany::class, $team->members());
        $this->assertInstanceOf(MaintenanceTeamMember::class, $team->members()->getRelated());
    }

    #[Test]
    public function manager_returns_belongs_to_relation(): void {
        $team = new AssetMaintenanceTeam;

        $this->assertInstanceOf(BelongsTo::class, $team->manager());
        $this->assertInstanceOf(User::class, $team->manager()->getRelated());
    }

    #[Test]
    public function branch_returns_belongs_to_relation(): void {
        $team = new AssetMaintenanceTeam;

        $this->assertInstanceOf(BelongsTo::class, $team->branch());
        $this->assertInstanceOf(Branch::class, $team->branch()->getRelated());
    }

    #[Test]
    public function members_relation_returns_created_rows(): void {
        $team = AssetMaintenanceTeam::factory()->create();
        MaintenanceTeamMember::factory()->count(2)->create(['maintenance_team_id' => $team->id]);

        $this->assertCount(2, $team->members);
    }
}
