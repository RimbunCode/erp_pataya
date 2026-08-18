<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Events\Asset\AssetServiceCompleted;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Services\Asset\AssetServiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        AssetService::initPermissions();
    }

    #[Test]
    public function submit_rejects_repair_when_asset_status_terminal(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::SCRAPPED]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        $this->expectException(LogicException::class);
        (new AssetServiceService)->submit($service);
    }

    #[Test]
    public function submit_repair_goes_through_approval_and_sets_out_of_order(): void {
        Event::fake([AssetServiceCompleted::class]);

        $asset   = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        (new AssetServiceService)->submit($service);

        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::OUT_OF_ORDER, $asset->status, true));
    }

    #[Test]
    public function submit_maintenance_task_bypasses_approval_and_sets_in_maintenance(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create(['asset_maintenance_id' => $maintenance->id]);
        $service     = AssetService::factory()->create([
            'type'                      => AssetServiceType::MAINTENANCE_TASK,
            'asset_id'                  => null,
            'asset_maintenance_task_id' => $task->id,
        ]);

        (new AssetServiceService)->submit($service);

        $service->refresh();
        $this->assertTrue(\in_array(FormStatus::APPROVED, $service->status, true));

        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::IN_MAINTENANCE, $asset->status, true));
    }

    #[Test]
    public function complete_rejects_when_checklist_incomplete(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::OUT_OF_ORDER]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'is_done' => false]);

        $this->expectException(LogicException::class);
        (new AssetServiceService)->complete($service);
    }

    #[Test]
    public function complete_repair_with_capitalize_adds_cost_to_asset(): void {
        Event::fake([AssetServiceCompleted::class]);

        $asset   = Asset::factory()->create(['status' => [FormStatus::OUT_OF_ORDER], 'additional_asset_cost' => 0]);
        $service = AssetService::factory()->create([
            'type'                   => AssetServiceType::REPAIR,
            'asset_id'               => $asset->id,
            'capitalize_repair_cost' => true,
            'increase_in_asset_life' => 6,
        ]);
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'is_done' => true]);
        AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $service->id,
            'quantity'         => 2,
            'valuation_rate'   => 500,
        ]);

        (new AssetServiceService)->complete($service);

        $asset->refresh();
        $this->assertEqualsWithDelta(1000.0, (float) $asset->additional_asset_cost, 0.001);
        $this->assertSame(6, $asset->increase_in_asset_life);
        Event::assertDispatched(AssetServiceCompleted::class, fn ($e) => $e->assetService->is($service));
    }

    #[Test]
    public function complete_maintenance_task_regenerates_next_service_and_updates_task(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create([
            'asset_maintenance_id' => $maintenance->id,
            'periodicity'          => 30,
        ]);
        $service = (new AssetServiceService)->generateForTask($task);
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'is_done' => true]);

        (new AssetServiceService)->complete($service);

        $task->refresh();
        $this->assertNotNull($task->last_completion_date);
        $this->assertCount(2, $task->services);

        $newService = $task->services()->latest('id')->first();
        $this->assertTrue(\in_array(FormStatus::APPROVED, $newService->status, true));
    }

    #[Test]
    public function complete_repair_does_not_generate_new_service(): void {
        Event::fake([AssetServiceCompleted::class]);

        $asset   = Asset::factory()->create(['status' => [FormStatus::OUT_OF_ORDER]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'is_done' => true]);

        (new AssetServiceService)->complete($service);

        $this->assertSame(1, AssetService::count());
    }
}
