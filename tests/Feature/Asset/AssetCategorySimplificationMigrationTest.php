<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AssetCategorySimplificationMigrationTest extends TestCase {
    use RefreshDatabase;

    public function test_assets_table_has_rentable_flag_columns(): void {
        $this->assertTrue(Schema::hasColumn('assets', 'is_rentable'));
        $this->assertTrue(Schema::hasColumn('assets', 'allow_bulk_quantity'));
    }

    public function test_asset_categories_table_no_longer_has_rentable_flag_columns(): void {
        $this->assertFalse(Schema::hasColumn('asset_categories', 'is_rentable'));
        $this->assertFalse(Schema::hasColumn('asset_categories', 'allow_bulk_quantity'));
    }

    public function test_new_asset_defaults_rentable_flags_to_false(): void {
        // AssetCategory::create() manual (bukan factory) -- AssetCategoryFactory
        // masih mengisi field yang sudah dihapus migrasi ini sampai Task 3.1 jalan.
        $category = AssetCategory::create(['category_name' => 'Kategori Uji ' . uniqid()]);
        // ->refresh(): kolom default DB (bukan dikirim factory) tidak otomatis
        // ter-load ke instance PHP setelah create(), sama seperti kolom generated.
        // getRawOriginal(): cek nilai DB mentah -- $casts boolean baru ditambah
        // di Task 4.2, belum ada saat test skema migrasi ini ditulis (Task 1.3).
        $asset = Asset::factory()->create(['asset_category_id' => $category->id])->refresh();

        $this->assertEquals(0, $asset->getRawOriginal('is_rentable'));
        $this->assertEquals(0, $asset->getRawOriginal('allow_bulk_quantity'));
    }
}
