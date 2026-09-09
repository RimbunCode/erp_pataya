<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Inventory\Item;
use App\Models\User\User;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceUpdateDebugTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function debug_update_nullable_fields(): void {
        $cat = AssetCategory::factory()->create();
        $loc = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->assertNull($asset->asset_category_id);
        $this->assertNull($asset->asset_location_id);

        $service = app(AssetService::class);
        $service->update($asset, [
            'asset_category_id' => $cat->id,
            'asset_location_id' => $loc->id,
        ]);

        $asset->refresh();

        $this->assertEquals($cat->id, $asset->asset_category_id, 'category_id should be updated');
        $this->assertEquals($loc->id, $asset->asset_location_id, 'location_id should be updated');
    }

    #[Test]
    public function update_extracts_item_and_custodian_id_from_relation_objects(): void {
        $item      = Item::factory()->create();
        $custodian = User::factory()->create();
        $asset     = Asset::factory()->create([
            'item_id'      => null,
            'custodian_id' => null,
        ]);

        $service = app(AssetService::class);
        $service->update($asset, [
            'item'      => ['id' => $item->id],
            'custodian' => ['id' => $custodian->id],
        ]);

        $asset->refresh();

        $this->assertEquals($item->id, $asset->item_id);
        $this->assertEquals($custodian->id, $asset->custodian_id);
    }

    #[Test]
    public function update_clears_item_id_when_item_object_is_explicitly_null(): void {
        $item  = Item::factory()->create();
        $asset = Asset::factory()->create(['item_id' => $item->id]);

        $service = app(AssetService::class);
        $service->update($asset, ['item' => null]);

        $asset->refresh();

        $this->assertNull($asset->item_id);
    }
}
