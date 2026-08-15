<?php

namespace Tests\Unit\Listeners\Asset\Maintenance;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Events\Asset\AssetServiceCompleted;
use App\Listeners\Asset\Maintenance\ReactivateAssetFromService;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReactivateAssetFromServiceTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function reactivates_asset_for_repair_type(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::OUT_OF_ORDER]]);
        $service = AssetService::factory()->create(['type' => AssetServiceType::REPAIR, 'asset_id' => $asset->id]);

        (new ReactivateAssetFromService)->handle(new AssetServiceCompleted($service));

        $asset->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
    }

    #[Test]
    public function reactivates_asset_for_maintenance_task_type(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::IN_MAINTENANCE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create(['asset_maintenance_id' => $maintenance->id]);
        $service     = AssetService::factory()->create([
            'type'                      => AssetServiceType::MAINTENANCE_TASK,
            'asset_id'                  => null,
            'asset_maintenance_task_id' => $task->id,
        ]);

        (new ReactivateAssetFromService)->handle(new AssetServiceCompleted($service));

        $asset->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
    }
}
