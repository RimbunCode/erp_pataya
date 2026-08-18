<?php

namespace Tests\Unit\Asset;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AssetPurchaseMigrationShapeTest extends TestCase {
    use RefreshDatabase;

    public function test_items_table_has_fixed_asset_columns(): void {
        $this->assertTrue(Schema::hasColumn('items', 'is_fixed_asset'), 'items.is_fixed_asset should exist');
        $this->assertTrue(Schema::hasColumn('items', 'asset_category_id'), 'items.asset_category_id should exist');
    }

    public function test_assets_table_has_purchase_reference_columns(): void {
        $this->assertTrue(Schema::hasColumn('assets', 'purchase_receipt_item_id'), 'assets.purchase_receipt_item_id should exist');
        $this->assertTrue(Schema::hasColumn('assets', 'purchase_invoice_item_id'), 'assets.purchase_invoice_item_id should exist');
    }

    public function test_asset_category_id_and_location_id_are_nullable(): void {
        $code = 'TST-' . fake()->unique()->randomNumber(6);

        DB::table('assets')->insert([
            'id'                => ($ulid = fake()->uuid()),
            'asset_name'        => 'Test Asset',
            'code'              => $code,
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_type'        => 'existing_asset',
            'ownership_type'    => 'company',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $asset = DB::table('assets')->where('code', $code)->first();
        $this->assertNotNull($asset);
        $this->assertNull($asset->asset_category_id);
        $this->assertNull($asset->asset_location_id);
    }

    public function test_is_fixed_asset_defaults_to_false(): void {
        $code = 'ITM-' . fake()->unique()->randomNumber(6);

        DB::table('items')->insert([
            'id'         => fake()->uuid(),
            'code'       => $code,
            'name'       => 'Test Item',
            'type'       => 'product',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $item = DB::table('items')->where('code', $code)->first();
        $this->assertNotNull($item);
        $this->assertEquals(0, $item->is_fixed_asset, 'is_fixed_asset should default to false');
    }
}
