<?php

namespace Tests\Feature;

use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Services\Sales\RentalDurationService;
use Carbon\Carbon;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class RentalDurationCalculationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function makeSalesOrderItem(bool $isRent = true): SalesOrderItem {
        $itemVariant = ItemVariantFactory::new()->create();

        $salesOrderId = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'         => $salesOrderId,
            'date'       => now(),
            'is_rent'    => $isRent,
            'amount'     => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $salesOrderItemId = (string) Str::ulid();
        DB::table('sales_order_items')->insert([
            'id'             => $salesOrderItemId,
            'sales_order_id' => $salesOrderId,
            'item_id'        => $itemVariant->id,
            'quantity'       => 5,
            'price'          => 3_000_000,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return SalesOrderItem::find($salesOrderItemId);
    }

    private function makePermissionId(): string {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId,
            'module'     => 'inventory',
            'name'       => 'delivery_note_test_' . $permissionId,
            'model'      => 'App\\Models\\Inventory\\DeliveryNote',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $permissionId;
    }

    private function makeDeliveryNoteItem(SalesOrderItem $soItem, float $quantity, string $deliveryDate, ?string $returnAgainstItemId = null): string {
        $deliveryNoteId = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $deliveryNoteId,
            'delivery_date'      => $deliveryDate,
            'reference_to_id'    => $this->makePermissionId(),
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $soItem->sales_order_id,
            'return_against_id'  => null,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        $deliveryNoteItemId = (string) Str::ulid();
        DB::table('delivery_note_items')->insert([
            'id'                     => $deliveryNoteItemId,
            'delivery_note_id'       => $deliveryNoteId,
            'referenceable_type'     => SalesOrderItem::class,
            'referenceable_id'       => $soItem->id,
            'item_id'                => $soItem->item_id,
            'valuation_rates'        => json_encode([]),
            'quantity'               => $quantity,
            'return_against_item_id' => $returnAgainstItemId,
            'created_at'             => now(),
            'updated_at'             => now(),
        ]);

        return $deliveryNoteItemId;
    }

    public function test_full_return_results_in_completed_status(): void {
        $soItem        = $this->makeSalesOrderItem();
        $shippedItemId = $this->makeDeliveryNoteItem($soItem, 5, '2026-08-01');
        $this->makeDeliveryNoteItem($soItem, 5, '2026-08-05', $shippedItemId);

        $service = app(RentalDurationService::class);
        $result  = $service->calculateDuration($soItem->fresh());

        $this->assertSame('completed', $result['status']);
        $this->assertCount(1, $result['segments']);
        $this->assertSame(5, $result['segments'][0]['duration_days']);
        $this->assertSame('completed', $result['segments'][0]['status']);
    }

    public function test_no_return_yet_results_in_running_status_with_cutoff(): void {
        $soItem = $this->makeSalesOrderItem();
        $this->makeDeliveryNoteItem($soItem, 5, '2026-08-01');

        $service = app(RentalDurationService::class);
        $result  = $service->calculateDuration($soItem->fresh(), Carbon::parse('2026-08-10'));

        $this->assertSame('running', $result['status']);
        $this->assertCount(1, $result['segments']);
        $this->assertSame(10, $result['segments'][0]['duration_days']);
    }

    public function test_partial_return_results_in_partially_completed_status(): void {
        $soItem        = $this->makeSalesOrderItem();
        $shippedItemId = $this->makeDeliveryNoteItem($soItem, 5, '2026-08-01');
        $this->makeDeliveryNoteItem($soItem, 2, '2026-08-05', $shippedItemId);

        $service = app(RentalDurationService::class);
        $result  = $service->calculateDuration($soItem->fresh(), Carbon::parse('2026-08-10'));

        $this->assertSame('partially_completed', $result['status']);
        $this->assertCount(2, $result['segments']);

        $completedSegment = collect($result['segments'])->firstWhere('status', 'completed');
        $runningSegment   = collect($result['segments'])->firstWhere('status', 'running');

        $this->assertEqualsWithDelta(2.0, $completedSegment['quantity'], 0.001);
        $this->assertEqualsWithDelta(3.0, $runningSegment['quantity'], 0.001);
    }

    public function test_no_delivery_note_item_at_all_results_in_null_status(): void {
        $soItem = $this->makeSalesOrderItem();

        $service = app(RentalDurationService::class);
        $result  = $service->calculateDuration($soItem->fresh());

        $this->assertNull($result['status']);
        $this->assertSame([], $result['segments']);
    }
}
