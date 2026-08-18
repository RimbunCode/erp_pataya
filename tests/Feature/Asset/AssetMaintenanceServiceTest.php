<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Services\Asset\Maintenance\AssetMaintenanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMaintenanceServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        AssetService::initPermissions();
    }

    #[Test]
    public function create_task_for_asset_without_existing_maintenance_creates_one(): void {
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $this->assertDatabaseMissing('asset_maintenances', ['asset_id' => $asset->id]);

        $task = (new AssetMaintenanceService)->createTaskForAsset($asset->id, [
            'task_name'        => 'Ganti oli',
            'maintenance_type' => 'preventive',
            'periodicity'      => 30,
            'next_due_date'    => now()->addDays(30),
        ]);

        $this->assertDatabaseHas('asset_maintenances', ['asset_id' => $asset->id]);
        $this->assertSame($asset->id, $task->assetMaintenance->asset_id);
    }

    #[Test]
    public function create_task_generates_first_asset_service_auto_approved(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);

        $task = (new AssetMaintenanceService)->createTask($maintenance, [
            'task_name'        => 'Kalibrasi',
            'maintenance_type' => 'calibration',
            'periodicity'      => 90,
            'next_due_date'    => now()->addDays(90),
        ]);

        $service = $task->services()->first();
        $this->assertNotNull($service);
        $this->assertSame(AssetServiceType::MAINTENANCE_TASK, $service->type);
        $this->assertTrue(\in_array(FormStatus::APPROVED, $service->status, true));

        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::IN_MAINTENANCE, $asset->status, true));
    }
}
