<?php

namespace Tests\Unit\Asset\Maintenance;

use App\Models\Asset\AssetService;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMaintenanceTaskTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_maintenance_returns_belongs_to_relation(): void {
        $task = new AssetMaintenanceTask;

        $this->assertInstanceOf(BelongsTo::class, $task->assetMaintenance());
        $this->assertInstanceOf(AssetMaintenance::class, $task->assetMaintenance()->getRelated());
    }

    #[Test]
    public function assign_to_returns_belongs_to_relation(): void {
        $task = new AssetMaintenanceTask;

        $this->assertInstanceOf(BelongsTo::class, $task->assignTo());
        $this->assertInstanceOf(User::class, $task->assignTo()->getRelated());
    }

    #[Test]
    public function services_returns_has_many_relation(): void {
        $task = new AssetMaintenanceTask;

        $this->assertInstanceOf(HasMany::class, $task->services());
        $this->assertInstanceOf(AssetService::class, $task->services()->getRelated());
    }

    #[Test]
    public function no_route_registered_for_asset_maintenance_task(): void {
        $this->assertFalse(Route::has('assetMaintenanceTasks.index'));
        $this->assertFalse(Route::has('assetMaintenanceTasks.show'));
    }
}
