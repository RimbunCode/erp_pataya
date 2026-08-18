<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
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
}
