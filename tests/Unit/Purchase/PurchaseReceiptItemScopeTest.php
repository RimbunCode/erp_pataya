<?php

namespace Tests\Unit\Purchase;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\User\User;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * scopeLinkModel() PurchaseReceiptItem — dipakai LinkModel link manual
 * Asset↔Purchase (spec asset-management-purchase-integration-v2, Requirement 2).
 */
class PurchaseReceiptItemScopeTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // initPermissions() runtime-patch kolom shared trait Submitable
        // (status/code/branch_id/dst) via Schema::hasColumn() -- lihat
        // DataTable::initPermissions(). Wajib dipanggil di sini supaya
        // create() PurchaseReceipt konsisten sukses terlepas dari test lain
        // yang kebetulan jalan lebih dulu dalam proses yang sama.
        foreach ([FormatingSeries::class, PurchaseReceipt::class, Asset::class] as $model) {
            $model::initPermissions();
        }
    }

    private function makeReceiptItem(ItemVariant $variant, float $quantity = 1): PurchaseReceiptItem {
        $user = User::factory()->create();

        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'          => 'PR-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));

        return PurchaseReceiptItem::create([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
        ]);
    }

    #[Test]
    public function only_returns_rows_for_fixed_asset_items(): void {
        $fixedAssetItem = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $regularItem    = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $fixedVariant   = ItemVariantFactory::new()->create(['item_id' => $fixedAssetItem->id]);
        $regularVariant = ItemVariantFactory::new()->create(['item_id' => $regularItem->id]);

        $fixedRow   = $this->makeReceiptItem($fixedVariant);
        $regularRow = $this->makeReceiptItem($regularVariant);

        $results = PurchaseReceiptItem::linkModel('')->get();

        $this->assertTrue($results->contains('id', $fixedRow->id));
        $this->assertFalse($results->contains('id', $regularRow->id));
    }

    #[Test]
    public function excludes_rows_already_converted_to_asset(): void {
        $item    = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $variant = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        $convertedRow   = $this->makeReceiptItem($variant);
        $unconvertedRow = $this->makeReceiptItem($variant);

        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        Asset::factory()->create([
            'item_id'                  => $item->id,
            'asset_category_id'        => $category->id,
            'asset_location_id'        => $location->id,
            'purchase_receipt_item_id' => $convertedRow->id,
        ]);

        $results = PurchaseReceiptItem::linkModel('')->get();

        $this->assertFalse($results->contains('id', $convertedRow->id));
        $this->assertTrue($results->contains('id', $unconvertedRow->id));
    }

    #[Test]
    public function includes_rows_whose_asset_is_soft_deleted(): void {
        $item    = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $variant = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        $row = $this->makeReceiptItem($variant);

        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create([
            'item_id'                  => $item->id,
            'asset_category_id'        => $category->id,
            'asset_location_id'        => $location->id,
            'purchase_receipt_item_id' => $row->id,
        ]);
        // Asset::canDelete() selalu false (ERPNext: Asset tidak mengenal
        // cancel/delete) — bypass guard LinkModel::bootLinkModel() khusus test ini.
        BaseModel::withoutEvents(fn () => $asset->delete());

        $results = PurchaseReceiptItem::linkModel('')->get();

        $this->assertTrue($results->contains('id', $row->id));
    }
}
