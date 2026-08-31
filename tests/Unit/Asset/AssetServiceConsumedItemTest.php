<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceConsumedItemTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_service_returns_belongs_to_relation(): void {
        $item = new AssetServiceConsumedItem;

        $this->assertInstanceOf(BelongsTo::class, $item->assetService());
        $this->assertInstanceOf(AssetService::class, $item->assetService()->getRelated());
    }

    #[Test]
    public function item_returns_belongs_to_relation(): void {
        // Requirement 4.5, spec asset-service-billing: item_id direwire ke
        // ItemVariant (bukan Item), selaras SalesOrderItem/InternalOrderItem.
        $item = new AssetServiceConsumedItem;

        $this->assertInstanceOf(BelongsTo::class, $item->item());
        $this->assertInstanceOf(ItemVariant::class, $item->item()->getRelated());
    }

    #[Test]
    public function total_value_computed_on_save(): void {
        $item = AssetServiceConsumedItem::factory()->create([
            'quantity'       => 3,
            'valuation_rate' => 1500,
        ]);

        $this->assertEqualsWithDelta(4500.0, (float) $item->total_value, 0.001);
    }
}
