<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Core\FormatingSeries;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceSplitTest extends TestCase {
    use RefreshDatabase;

    private AssetService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = app(AssetService::class);

        // split() menghasilkan Asset baru via FormatingSeries::generate() (kode draft) —
        // butuh record FormatingSeries + Preference timezone, sama seperti
        // AssetControllerTest, karena initPermissions() tidak jalan otomatis di test.
        Asset::initPermissions();
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    #[Test]
    public function split_into_rows_with_uneven_quantity_distribution(): void {
        $category = AssetCategory::factory()->bulkQuantity()->create();
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id'     => null,
            'asset_location_id'     => null,
            'asset_quantity'        => 5,
            'gross_purchase_amount' => 1000,
            'net_purchase_amount'   => 900,
        ]);

        $results = $this->service->split($asset, [
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 3],
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 1],
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 1],
        ]);

        $this->assertCount(3, $results);
        $this->assertEquals([3, 1, 1], $results->pluck('asset_quantity')->toArray());
        $this->assertEquals(5, $results->sum('asset_quantity'));
        $this->assertSoftDeleted($asset);
    }

    #[Test]
    public function split_preserves_total_monetary_value(): void {
        $category = AssetCategory::factory()->bulkQuantity()->create();
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id'     => null,
            'asset_location_id'     => null,
            'asset_quantity'        => 5,
            'gross_purchase_amount' => 1000,
            'net_purchase_amount'   => 900,
            'additional_asset_cost' => 100,
        ]);

        $results = $this->service->split($asset, [
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 3],
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 1],
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 1],
        ]);

        $this->assertEqualsWithDelta(1000, $results->sum('gross_purchase_amount'), 0.02);
        $this->assertEqualsWithDelta(900, $results->sum('net_purchase_amount'), 0.02);
        $this->assertEqualsWithDelta(100, $results->sum('additional_asset_cost'), 0.02);
    }

    #[Test]
    public function split_rows_can_have_different_category_and_location(): void {
        $categoryA = AssetCategory::factory()->bulkQuantity()->create();
        $categoryB = AssetCategory::factory()->create();
        $locationA = AssetLocation::factory()->create();
        $locationB = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 3,
        ]);

        $results = $this->service->split($asset, [
            ['asset_category_id' => $categoryA->id, 'asset_location_id' => $locationA->id, 'quantity' => 2],
            ['asset_category_id' => $categoryB->id, 'asset_location_id' => $locationB->id, 'quantity' => 1],
        ]);

        $this->assertEquals($categoryA->id, $results[0]->asset_category_id);
        $this->assertEquals($locationA->id, $results[0]->asset_location_id);
        $this->assertEquals($categoryB->id, $results[1]->asset_category_id);
        $this->assertEquals($locationB->id, $results[1]->asset_location_id);
    }

    #[Test]
    public function split_all_into_individual_units(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 5,
        ]);

        $rows = array_fill(0, 5, [
            'asset_category_id' => $category->id,
            'asset_location_id' => $location->id,
            'quantity'          => 1,
        ]);

        $results = $this->service->split($asset, $rows);

        $this->assertCount(5, $results);
        foreach ($results as $result) {
            $this->assertEquals(1, $result->asset_quantity);
        }
    }

    #[Test]
    public function split_inherits_source_document_fields(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 2,
            'asset_name'        => 'Laptop Test',
        ]);

        $results = $this->service->split($asset, [
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 1],
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 1],
        ]);

        foreach ($results as $result) {
            $this->assertEquals('Laptop Test', $result->asset_name);
        }
    }

    #[Test]
    public function split_rejects_rows_with_quantity_mismatch(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 5,
        ]);

        $this->expectException(LogicException::class);

        $this->service->split($asset, [
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 2],
            ['asset_category_id' => $category->id, 'asset_location_id' => $location->id, 'quantity' => 2],
        ]);
    }
}
