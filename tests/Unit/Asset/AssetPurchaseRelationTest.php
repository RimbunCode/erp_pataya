<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetPurchaseRelationTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function item_has_asset_category_relation(): void {
        $item = Item::create([
            'code'           => 'ITM-' . fake()->unique()->randomNumber(6),
            'name'           => 'Test Fixed Asset Item',
            'type'           => 'product',
            'is_fixed_asset' => true,
        ]);

        $this->assertInstanceOf(BelongsTo::class, $item->assetCategory());
        $this->assertNull($item->assetCategory);

        $category = AssetCategory::factory()->create();
        $item->update(['asset_category_id' => $category->id]);
        $item->refresh()->load('assetCategory');

        $this->assertNotNull($item->assetCategory);
        $this->assertEquals($category->id, $item->assetCategory->id);
    }

    #[Test]
    public function asset_has_purchase_receipt_item_relation(): void {
        $asset = Asset::factory()->create();

        $this->assertInstanceOf(BelongsTo::class, $asset->purchaseReceiptItem());
        $this->assertNull($asset->purchaseReceiptItem);
    }

    #[Test]
    public function asset_has_purchase_invoice_item_relation(): void {
        $asset = Asset::factory()->create();

        $this->assertInstanceOf(BelongsTo::class, $asset->purchaseInvoiceItem());
        $this->assertNull($asset->purchaseInvoiceItem);
    }
}
