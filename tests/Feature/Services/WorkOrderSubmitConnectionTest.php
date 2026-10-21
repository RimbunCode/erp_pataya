<?php

namespace Tests\Feature\Services;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\ItemVariant;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Models\User\User;
use App\Services\Service\WorkOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WorkOrderSubmitConnectionTest extends TestCase {
    use RefreshDatabase;

    private function makeWorkOrder(): WorkOrder {
        WorkOrder::initPermissions();

        // Kode WO dibentuk FormatingSeries dari @[branch.code], jadi cabang wajib ada.
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);

        return WorkOrder::create([
            'code'          => fake()->unique()->bothify('WO-####'),
            'branch_id'     => $branch->id,
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);
    }

    private function makeItem(WorkOrder $workOrder, ?AssetServiceConsumedItem $source = null): WorkOrderItem {
        return WorkOrderItem::create([
            'work_order_id'      => $workOrder->id,
            'item_variant_id'    => ItemVariant::factory()->create()->id,
            'quantity'           => 1,
            'referenceable_type' => $source ? AssetServiceConsumedItem::class : null,
            'referenceable_id'   => $source?->id,
        ]);
    }

    #[Test]
    public function submit_records_item_connection_to_source_consumed_item(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $workOrder    = $this->makeWorkOrder();
        $item         = $this->makeItem($workOrder, $consumedItem);

        app(WorkOrderService::class)->submit($workOrder);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetServiceConsumedItem::class)
                ->where('model_id', $consumedItem->id)
                ->where('reference_type', WorkOrderItem::class)
                ->where('reference_id', $item->id)
                ->exists(),
            'Koneksi item tingkat pertama harus tercatat.',
        );
    }

    #[Test]
    public function submit_records_document_level_connection_to_parent_asset_service(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $workOrder    = $this->makeWorkOrder();
        $this->makeItem($workOrder, $consumedItem);

        app(WorkOrderService::class)->submit($workOrder);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetService::class)
                ->where('model_id', $consumedItem->asset_service_id)
                ->where('reference_type', WorkOrder::class)
                ->where('reference_id', $workOrder->id)
                ->exists(),
            'Koneksi tingkat dokumen ke induk (AssetService) harus muncul.',
        );
    }

    #[Test]
    public function submit_writes_no_connection_when_item_has_no_referenceable(): void {
        $workOrder = $this->makeWorkOrder();
        $this->makeItem($workOrder);

        app(WorkOrderService::class)->submit($workOrder);

        $this->assertSame(0, ModelConnection::query()
            ->where('reference_type', WorkOrder::class)
            ->orWhere('reference_type', WorkOrderItem::class)
            ->count());
    }

    #[Test]
    public function submit_twice_does_not_duplicate_connections(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $workOrder    = $this->makeWorkOrder();
        $this->makeItem($workOrder, $consumedItem);

        $service = app(WorkOrderService::class);
        $service->submit($workOrder);
        $countAfterFirst = ModelConnection::count();

        $service->submit($workOrder);

        $this->assertSame($countAfterFirst, ModelConnection::count());
    }
}
