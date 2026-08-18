<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
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
        $item = new AssetServiceConsumedItem;

        $this->assertInstanceOf(BelongsTo::class, $item->item());
        $this->assertInstanceOf(Item::class, $item->item()->getRelated());
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
