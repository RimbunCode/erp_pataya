<?php

namespace Tests\Unit\Finances;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\User\User;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * scopeLinkModel() PurchaseInvoiceItem — dipakai LinkModel link manual
 * Asset↔Purchase (spec asset-management-purchase-integration-v2, Requirement 2).
 */
class PurchaseInvoiceItemScopeTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // initPermissions() runtime-patch kolom shared trait Submitable
        // (status/code/branch_id/dst) via Schema::hasColumn() -- lihat
        // DataTable::initPermissions(). Dipanggil di sini supaya robust
        // terlepas dari test lain yang kebetulan jalan lebih dulu dalam
        // proses yang sama (kolom code jadi UNIQUE NOT NULL begitu dipanggil).
        foreach ([FormatingSeries::class, Asset::class, PurchaseInvoice::class] as $model) {
            $model::initPermissions();
        }
    }

    private function makeInvoiceItem(ItemVariant $variant, float $quantity = 1, float $rate = 1000): PurchaseInvoiceItem {
        $user    = User::factory()->create();
        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'          => 'PI-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));

        return PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
            'rate'                => $rate,
        ]);
    }

    #[Test]
    public function only_returns_rows_for_fixed_asset_items(): void {
        $fixedAssetItem = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $regularItem    = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $fixedVariant   = ItemVariantFactory::new()->create(['item_id' => $fixedAssetItem->id]);
        $regularVariant = ItemVariantFactory::new()->create(['item_id' => $regularItem->id]);

        $fixedRow   = $this->makeInvoiceItem($fixedVariant);
        $regularRow = $this->makeInvoiceItem($regularVariant);

        $results = PurchaseInvoiceItem::linkModel('')->get();

        $this->assertTrue($results->contains('id', $fixedRow->id));
        $this->assertFalse($results->contains('id', $regularRow->id));
    }

    #[Test]
    public function excludes_rows_already_converted_to_asset(): void {
        $item    = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $variant = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        $convertedRow   = $this->makeInvoiceItem($variant);
        $unconvertedRow = $this->makeInvoiceItem($variant);

        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        Asset::factory()->create([
            'item_id'                  => $item->id,
            'asset_category_id'        => $category->id,
            'asset_location_id'        => $location->id,
            'purchase_invoice_item_id' => $convertedRow->id,
        ]);

        $results = PurchaseInvoiceItem::linkModel('')->get();

        $this->assertFalse($results->contains('id', $convertedRow->id));
        $this->assertTrue($results->contains('id', $unconvertedRow->id));
    }

    #[Test]
    public function includes_rows_whose_asset_is_soft_deleted(): void {
        $item    = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $variant = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        $row = $this->makeInvoiceItem($variant);

        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create([
            'item_id'                  => $item->id,
            'asset_category_id'        => $category->id,
            'asset_location_id'        => $location->id,
            'purchase_invoice_item_id' => $row->id,
        ]);
        // Asset::canDelete() selalu false (ERPNext: Asset tidak mengenal
        // cancel/delete) — bypass guard LinkModel::bootLinkModel() khusus test ini.
        BaseModel::withoutEvents(fn () => $asset->delete());

        $results = PurchaseInvoiceItem::linkModel('')->get();

        $this->assertTrue($results->contains('id', $row->id));
    }
}
