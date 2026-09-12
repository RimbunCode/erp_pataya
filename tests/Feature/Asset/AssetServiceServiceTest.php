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
use App\Models\Core\Branch;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
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

        // [FIXED] onApproved() sebelumnya hanya meng-update status Asset terkait,
        // tidak pernah meng-update status AssetService sendiri -- dokumen tetap
        // "draft" walau submit() sukses tanpa error.
        // NEED_CONFIRMATION (spec asset-service-progress-workflow Req 1 AC2)
        // -- APPROVED tidak lagi persisten setelah onApproved().
        $service->refresh();
        $this->assertTrue(\in_array(FormStatus::NEED_CONFIRMATION, $service->status, true));
    }

    /**
     * SUBMITTED bukan status "siap pakai" yang sah -- Asset::onApproved()
     * (App\Services\Asset\AssetService) selalu default available_for_use_date
     * ke sekarang kalau kosong, jadi Asset ter-approve langsung ACTIVE, tidak
     * pernah nyangkut permanen di SUBMITTED. setOutOfOrder() sengaja TIDAK
     * mengizinkan transisi dari SUBMITTED.
     */
    #[Test]
    public function submit_repair_rejected_when_asset_status_submitted(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::SUBMITTED]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        $this->expectException(LogicException::class);

        (new AssetServiceService)->submit($service);
    }

    /**
     * [FIXED] cancel() sebelumnya hanya meng-update status AssetService
     * sendiri jadi CANCELED, tidak pernah me-rollback status Asset yang
     * di-set onApproved() (setOutOfOrder()) -- Asset tertinggal permanen
     * di out_of_order walau servisnya sudah dibatalkan.
     */
    #[Test]
    public function cancel_repair_reactivates_asset(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        (new AssetServiceService)->submit($service);
        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::OUT_OF_ORDER, $asset->status, true));

        (new AssetServiceService)->cancel($service);

        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::ACTIVE, $asset->status, true));
        $this->assertFalse(\in_array(FormStatus::OUT_OF_ORDER, $asset->status, true));

        $service->refresh();
        $this->assertTrue(\in_array(FormStatus::CANCELED, $service->status, true));
    }

    #[Test]
    public function cancel_maintenance_task_reactivates_asset(): void {
        $asset       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create(['asset_maintenance_id' => $maintenance->id]);
        $service     = AssetService::factory()->create([
            'type'                      => AssetServiceType::MAINTENANCE_TASK,
            'asset_id'                  => null,
            'asset_maintenance_task_id' => $task->id,
        ]);

        (new AssetServiceService)->submit($service);
        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::IN_MAINTENANCE, $asset->status, true));

        (new AssetServiceService)->cancel($service);

        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::ACTIVE, $asset->status, true));
        $this->assertFalse(\in_array(FormStatus::IN_MAINTENANCE, $asset->status, true));
    }

    /**
     * cancel() tidak boleh gagal walau Asset sudah bukan di status yang
     * di-set servis ini lagi (mis. sudah di-scrap manual di luar alur ini).
     */
    #[Test]
    public function cancel_does_not_fail_when_asset_status_already_changed(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        (new AssetServiceService)->submit($service);
        $asset->refresh();
        $asset->scrap();

        // fresh() (bukan $service dari sebelumnya) -- $service->asset lama
        // sudah ter-cache dari submit(), tidak tahu soal scrap() yang baru
        // saja terjadi lewat referensi $asset terpisah. Model baru per
        // request HTTP nyata tidak kena isu ini.
        (new AssetServiceService)->cancel($service->fresh());

        $service->refresh();
        $this->assertTrue(\in_array(FormStatus::CANCELED, $service->status, true));

        $asset->refresh();
        $this->assertTrue(\in_array(FormStatus::SCRAPPED, $asset->status, true));
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
        $this->assertTrue(\in_array(FormStatus::NEED_CONFIRMATION, $service->status, true));

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
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'status' => FormStatus::IN_PROGRESS]);

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
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'status' => FormStatus::COMPLETED]);
        AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $service->id,
            'quantity'         => 2,
            'valuation_rate'   => 500,
        ]);

        // fresh() -- AssetServiceActivity::booted() sinkron status lewat
        // instance $activity->assetService (fetch terpisah), BUKAN $service
        // yang di-genggam di sini. Di alur nyata ini otomatis fresh karena
        // storeActivity dan complete adalah 2 HTTP request terpisah.
        (new AssetServiceService)->complete($service->fresh());

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
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'status' => FormStatus::COMPLETED]);

        (new AssetServiceService)->complete($service->fresh());

        $task->refresh();
        $this->assertNotNull($task->last_completion_date);
        $this->assertCount(2, $task->services);

        $newService = $task->services()->latest('id')->first();
        $this->assertTrue(\in_array(FormStatus::NEED_CONFIRMATION, $newService->status, true));
    }

    #[Test]
    public function complete_repair_does_not_generate_new_service(): void {
        Event::fake([AssetServiceCompleted::class]);

        $asset   = Asset::factory()->create(['status' => [FormStatus::OUT_OF_ORDER]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);
        AssetServiceActivity::factory()->create(['asset_service_id' => $service->id, 'status' => FormStatus::COMPLETED]);

        (new AssetServiceService)->complete($service->fresh());

        $this->assertSame(1, AssetService::count());
    }

    /**
     * @return array{0: ItemVariant, 1: Branch}
     */
    private function makeItemVariantWithStock(float $readyQuantity = 10): array {
        $item        = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $unit        = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit    = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $branch      = Branch::create(['name' => 'Test Branch', 'is_main_branch' => true]);
        $warehouse   = Warehouse::create([
            'branch_id' => $branch->id,
            'name'      => 'Test Warehouse',
            'code'      => 'WH-' . fake()->unique()->numerify('####'),
        ]);

        // ready_quantity = (quantity - rented_quantity) - reserved_quantity,
        // kolom GENERATED (storedAs) -- isi via `quantity` mentah, biarkan
        // rented/reserved default 0 supaya ready_quantity == quantity.
        // stock_queue WAJIB diisi -- Stock::boot() saved() hook baca
        // array_column($model->stock_queue, 'quantity') tanpa null-guard.
        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => $readyQuantity,
            'conversion_factor' => 1,
            'stock_queue'       => [['quantity' => $readyQuantity, 'rate' => 1000]],
        ]);

        return [$itemVariant, $branch];
    }

    #[Test]
    public function start_work_succeeds_when_stock_available(): void {
        [$itemVariant, $branch] = $this->makeItemVariantWithStock(readyQuantity: 5);
        $asset                  = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $service                = AssetService::factory()->create([
            'type'      => AssetServiceType::REPAIR,
            'asset_id'  => $asset->id,
            'branch_id' => $branch->id,
            'status'    => [FormStatus::NEED_CONFIRMATION],
        ]);
        AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $service->id,
            'item_id'          => $itemVariant->id,
            'quantity'         => 2,
        ]);

        $result = (new AssetServiceService)->startWork($service);

        $this->assertNotNull($result->start_date);
        $this->assertSame(1, $result->activities()->count());
        $this->assertSame(FormStatus::IN_PROGRESS, $result->activities()->first()->status);
        $this->assertTrue(\in_array(FormStatus::IN_PROGRESS, $result->status, true));
    }

    #[Test]
    public function start_work_rejects_when_no_stock(): void {
        $asset   = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $branch  = Branch::create(['name' => 'Test Branch', 'is_main_branch' => true]);
        $service = AssetService::factory()->create([
            'type'      => AssetServiceType::REPAIR,
            'asset_id'  => $asset->id,
            'branch_id' => $branch->id,
            'status'    => [FormStatus::NEED_CONFIRMATION],
        ]);
        // consumedItem TANPA Stock sama sekali.
        AssetServiceConsumedItem::factory()->create(['asset_service_id' => $service->id]);

        try {
            (new AssetServiceService)->startWork($service);
            $this->fail('Expected LogicException tidak dilempar.');
        } catch (LogicException) {
            // expected
        }

        $this->assertNull($service->fresh()->start_date);
        $this->assertSame(0, $service->fresh()->activities()->count());
    }

    #[Test]
    public function mark_waiting_parts_only_affects_need_confirmation(): void {
        $needConfirmation = AssetService::factory()->create(['status' => [FormStatus::NEED_CONFIRMATION]]);
        $item1            = AssetServiceConsumedItem::factory()->create(['asset_service_id' => $needConfirmation->id]);

        $alreadyInProgress = AssetService::factory()->create(['status' => [FormStatus::IN_PROGRESS]]);
        $item2             = AssetServiceConsumedItem::factory()->create(['asset_service_id' => $alreadyInProgress->id]);

        (new AssetServiceService)->markWaitingPartsForConsumedItems([$item1->id, $item2->id]);

        $this->assertTrue(\in_array(FormStatus::WAITING_PARTS, $needConfirmation->fresh()->status, true));
        $this->assertTrue(\in_array(FormStatus::IN_PROGRESS, $alreadyInProgress->fresh()->status, true));
        $this->assertFalse(\in_array(FormStatus::WAITING_PARTS, $alreadyInProgress->fresh()->status, true));
    }

    #[Test]
    public function complete_sets_completion_date_from_activity_action_date_not_now(): void {
        Event::fake([AssetServiceCompleted::class]);

        $asset   = Asset::factory()->create(['status' => [FormStatus::OUT_OF_ORDER]]);
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);
        $backdatedActionDate = now()->subDays(3)->startOfSecond();
        AssetServiceActivity::factory()->create([
            'asset_service_id' => $service->id,
            'status'           => FormStatus::COMPLETED,
            'action_date'      => $backdatedActionDate,
        ]);

        (new AssetServiceService)->complete($service->fresh());

        $service->refresh();
        $this->assertNotNull($service->completion_date);
        $this->assertTrue($service->completion_date->equalTo($backdatedActionDate));
    }
}
