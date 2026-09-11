<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_returns_belongs_to_relation(): void {
        $service = new AssetService;

        $this->assertInstanceOf(BelongsTo::class, $service->asset());
        $this->assertInstanceOf(Asset::class, $service->asset()->getRelated());
    }

    #[Test]
    public function asset_maintenance_task_returns_belongs_to_relation(): void {
        $service = new AssetService;

        $this->assertInstanceOf(BelongsTo::class, $service->assetMaintenanceTask());
        $this->assertInstanceOf(AssetMaintenanceTask::class, $service->assetMaintenanceTask()->getRelated());
    }

    #[Test]
    public function activities_returns_has_many_relation(): void {
        $service = new AssetService;

        $this->assertInstanceOf(HasMany::class, $service->activities());
        $this->assertInstanceOf(AssetServiceActivity::class, $service->activities()->getRelated());
    }

    #[Test]
    public function consumed_items_returns_has_many_relation(): void {
        $service = new AssetService;

        $this->assertInstanceOf(HasMany::class, $service->consumedItems());
        $this->assertInstanceOf(AssetServiceConsumedItem::class, $service->consumedItems()->getRelated());
    }

    #[Test]
    public function type_casts_to_enum(): void {
        $service = AssetService::factory()->create(['type' => AssetServiceType::REPAIR]);

        $this->assertInstanceOf(AssetServiceType::class, $service->type);
        $this->assertSame(AssetServiceType::REPAIR, $service->type);
    }

    #[Test]
    public function resolved_asset_returns_direct_asset_for_repair(): void {
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create(['type' => AssetServiceType::REPAIR, 'asset_id' => $asset->id]);

        $this->assertTrue($service->resolvedAsset()->is($asset));
    }

    #[Test]
    public function resolved_asset_returns_chained_asset_for_maintenance_task(): void {
        $asset       = Asset::factory()->create();
        $maintenance = AssetMaintenance::factory()->create(['asset_id' => $asset->id]);
        $task        = AssetMaintenanceTask::factory()->create(['asset_maintenance_id' => $maintenance->id]);
        $service     = AssetService::factory()->create([
            'type'                      => AssetServiceType::MAINTENANCE_TASK,
            'asset_id'                  => null,
            'asset_maintenance_task_id' => $task->id,
        ]);

        $this->assertTrue($service->resolvedAsset()->is($asset));
    }

    #[Test]
    public function has_passed_approval_is_false_for_draft_need_approval_and_canceled(): void {
        $service = AssetService::factory()->create();

        foreach ([FormStatus::DRAFT, FormStatus::NEED_APPROVAL, FormStatus::CANCELED] as $status) {
            $service->update(['status' => [$status]]);
            $this->assertFalse($service->fresh()->hasPassedApproval(), "status {$status->value} seharusnya belum lewat approval");
        }
    }

    /**
     * Bug ketemu (regression guard): array_intersect([], [...]) === []
     * vacuously true tanpa guard eksplisit -- status kosong/null harus tetap
     * "belum lewat approval", BUKAN otomatis true.
     */
    #[Test]
    public function has_passed_approval_is_false_when_status_empty(): void {
        $service = AssetService::factory()->create();
        $service->update(['status' => []]);

        $this->assertFalse($service->fresh()->hasPassedApproval());
    }

    #[Test]
    public function has_passed_approval_is_true_for_post_approval_statuses(): void {
        $service = AssetService::factory()->create();

        foreach ([
            FormStatus::NEED_CONFIRMATION,
            FormStatus::ON_HOLD,
            FormStatus::WAITING_PARTS,
            FormStatus::IN_PROGRESS,
            FormStatus::RESOLVED,
            FormStatus::WAITING,
            FormStatus::COMPLETED,
        ] as $status) {
            $service->update(['status' => [$status]]);
            $this->assertTrue($service->fresh()->hasPassedApproval(), "status {$status->value} seharusnya sudah lewat approval");
        }
    }

    #[Test]
    public function is_fully_checked_reads_status_directly(): void {
        $service = AssetService::factory()->create();

        $service->update(['status' => [FormStatus::IN_PROGRESS]]);
        $this->assertFalse($service->fresh()->isFullyChecked());

        $service->update(['status' => [FormStatus::COMPLETED]]);
        $this->assertTrue($service->fresh()->isFullyChecked());
    }
}
