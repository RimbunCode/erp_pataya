<?php

namespace Tests\Unit\Sales;

use App\Enums\FormStatus;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SalesOrderItemReferenceableBillingTest extends TestCase {
    use RefreshDatabase;

    private function makeSalesOrder(): SalesOrder {
        SalesOrder::initPermissions();

        return SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Bill', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);
    }

    #[Test]
    public function service_line_starts_fully_unbilled_like_normal_item(): void {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);
        $salesOrder   = $this->makeSalesOrder();

        $item = SalesOrderItem::create([
            'sales_order_id'     => $salesOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => 1,
            'price'              => 500000,
            'referenceable_type' => AssetService::class,
            'referenceable_id'   => $assetService->id,
        ]);

        // unbilled_quantity default belum di-set service-layer (fillItemRelations
        // dipanggil saat SalesOrderService::create(), bukan create() langsung),
        // tapi field TETAP ada dan tidak dipengaruhi kehadiran referenceable.
        $this->assertSame(AssetService::class, $item->referenceable_type);
        $this->assertTrue($item->referenceable->is($assetService));
    }

    #[Test]
    public function part_line_referenceable_resolves_to_consumed_item(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $salesOrder   = $this->makeSalesOrder();

        $item = SalesOrderItem::create([
            'sales_order_id'     => $salesOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => (float) $consumedItem->quantity,
            'price'              => (float) $consumedItem->valuation_rate,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);

        $this->assertTrue($item->referenceable->is($consumedItem));
        $this->assertEqualsWithDelta((float) $consumedItem->valuation_rate, (float) $item->price, 0.0001);
    }

    #[Test]
    public function null_referenceable_row_unaffected(): void {
        $salesOrder = $this->makeSalesOrder();

        $item = SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => ItemVariant::factory()->create()->id,
            'quantity'       => 1,
            'price'          => 100,
        ]);

        $this->assertNull($item->referenceable_type);
        $this->assertNull($item->referenceable);
    }
}
