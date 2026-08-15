<?php

namespace Tests\Unit\Asset\Maintenance;

use App\Models\Asset\Asset;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMaintenanceTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_returns_belongs_to_relation(): void {
        $maintenance = new AssetMaintenance;

        $this->assertInstanceOf(BelongsTo::class, $maintenance->asset());
        $this->assertInstanceOf(Asset::class, $maintenance->asset()->getRelated());
    }

    #[Test]
    public function maintenance_team_returns_belongs_to_relation(): void {
        $maintenance = new AssetMaintenance;

        $this->assertInstanceOf(BelongsTo::class, $maintenance->maintenanceTeam());
        $this->assertInstanceOf(AssetMaintenanceTeam::class, $maintenance->maintenanceTeam()->getRelated());
    }

    #[Test]
    public function tasks_returns_has_many_relation(): void {
        $maintenance = new AssetMaintenance;

        $this->assertInstanceOf(HasMany::class, $maintenance->tasks());
        $this->assertInstanceOf(AssetMaintenanceTask::class, $maintenance->tasks()->getRelated());
    }

    #[Test]
    public function asset_id_is_unique(): void {
        $asset = Asset::factory()->create();
        AssetMaintenance::factory()->create(['asset_id' => $asset->id]);

        $this->expectException(UniqueConstraintViolationException::class);
        AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
    }
}
