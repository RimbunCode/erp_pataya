<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
        $updated  = $item->update(['asset_category_id' => $category->id]);
        $item->refresh()->load('assetCategory');

        // DIAGNOSTIC SEMENTARA (hapus setelah root cause flaky test ini
        // ketemu -- lihat investigasi AssetPurchaseRelationTest::item_has_asset_category_relation
        // di tests/Unit/Asset/AssetPurchaseRelationTest.php, gagal intermiten
        // di CI shard 4/4 --functional, non-deterministic bahkan dgn SEED/SHARD
        // sama). Pesan ini cuma tampil kalau assertion di bawah gagal --
        // membedakan 3 hipotesis: (a) update() gak persisten, (b) global
        // scope exclude_example_data salah exclude row yg baru dibuat,
        // (c) row/relasi genuinely hilang.
        $diagnostic = fn () => json_encode([
            'pid'                   => getmypid(),
            'update_returned'       => $updated,
            'has_is_example_column' => Schema::hasColumn('asset_categories', 'is_example'),
            'raw_item_row'          => (array) DB::table('items')->where('id', $item->id)->first(),
            'raw_category_row'      => (array) DB::table('asset_categories')->where('id', $category->id)->first(),
            'unscoped_find'         => optional(
                AssetCategory::withoutGlobalScope('exclude_example_data')->find($category->id),
            )->only(['id', 'is_example', 'deleted_at']),
        ], JSON_PRETTY_PRINT);

        $this->assertNotNull($item->assetCategory, $diagnostic());
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
