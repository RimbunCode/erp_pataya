<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Models\Core\ModelConnection;
use App\Services\Asset\AssetServiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceConnectionTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        AssetService::initPermissions();
    }

    private function countConnectionsToService(AssetService $service): int {
        return ModelConnection::query()
            ->where('reference_type', AssetService::class)
            ->where('reference_id', $service->id)
            ->count();
    }

    #[Test]
    public function maintenance_task_submit_records_connection_from_task_to_service(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create(['asset_maintenance_id' => $maintenance->id]);
        $service     = AssetService::factory()->create([
            'type'                      => AssetServiceType::MAINTENANCE_TASK,
            'asset_id'                  => null,
            'asset_maintenance_task_id' => $task->id,
        ]);

        (new AssetServiceService)->submit($service);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetMaintenanceTask::class)
                ->where('model_id', $task->id)
                ->where('reference_type', AssetService::class)
                ->where('reference_id', $service->id)
                ->exists(),
            'Induk AssetMaintenanceTask harus tercatat di graf koneksi.',
        );
    }

    #[Test]
    public function repair_submit_with_maintenance_task_records_connection(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create(['asset_maintenance_id' => $maintenance->id]);
        $service     = AssetService::factory()->create([
            'type'                      => AssetServiceType::REPAIR,
            'asset_id'                  => $asset->id,
            'asset_maintenance_task_id' => $task->id,
        ]);

        (new AssetServiceService)->submit($service);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetMaintenanceTask::class)
                ->where('model_id', $task->id)
                ->where('reference_type', AssetService::class)
                ->where('reference_id', $service->id)
                ->exists(),
        );
    }

    #[Test]
    public function submit_without_maintenance_task_writes_no_connection(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        (new AssetServiceService)->submit($service);

        $this->assertSame(0, $this->countConnectionsToService($service));
    }
}
