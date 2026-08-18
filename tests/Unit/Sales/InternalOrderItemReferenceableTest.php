<?php

namespace Tests\Unit\Sales;

use App\Enums\FormStatus;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InternalOrderItemReferenceableTest extends TestCase {
    use RefreshDatabase;

    private function makeInternalOrder(): InternalOrder {
        InternalOrder::initPermissions();

        return InternalOrder::create([
            'code'          => fake()->unique()->bothify('IO-####'),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);
    }

    #[Test]
    public function referenceable_resolves_to_asset_service(): void {
        $internalOrder = $this->makeInternalOrder();
        $assetService  = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);

        $item = InternalOrderItem::create([
            'internal_order_id'  => $internalOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => 1,
            'referenceable_type' => AssetService::class,
            'referenceable_id'   => $assetService->id,
        ]);

        $this->assertTrue($item->referenceable->is($assetService));
    }

    #[Test]
    public function referenceable_resolves_to_asset_service_consumed_item(): void {
        $internalOrder = $this->makeInternalOrder();
        $consumedItem  = AssetServiceConsumedItem::factory()->create();

        $item = InternalOrderItem::create([
            'internal_order_id'  => $internalOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => (float) $consumedItem->quantity,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);

        $this->assertTrue($item->referenceable->is($consumedItem));
    }

    #[Test]
    public function null_referenceable_behaves_like_normal_item_row(): void {
        $internalOrder = $this->makeInternalOrder();

        $item = InternalOrderItem::create([
            'internal_order_id' => $internalOrder->id,
            'item_id'           => ItemVariant::factory()->create()->id,
            'quantity'          => 1,
        ]);

        $this->assertNull($item->referenceable_type);
        $this->assertNull($item->referenceable);
    }
}
