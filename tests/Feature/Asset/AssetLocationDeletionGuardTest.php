<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetLocationDeletionGuardTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function cannot_delete_location_with_asset_directly(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_location_id' => $location->id,
        ]);

        $this->expectException(\LogicException::class);

        $location->delete();
    }

    #[Test]
    public function cannot_delete_location_with_asset_in_child_subtree(): void {
        $parent   = AssetLocation::factory()->create();
        $child    = AssetLocation::factory()->withParent($parent)->create();
        $category = AssetCategory::factory()->create();

        // Asset is in the child, not the parent directly
        Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_location_id' => $child->id,
        ]);

        // Deleting parent should still be blocked (refresh: TreeView incremented rgt in DB but stale in memory)
        $this->expectException(\LogicException::class);

        $parent->refresh()->delete();
    }

    #[Test]
    public function can_delete_location_with_no_assets(): void {
        $location = AssetLocation::factory()->create();

        $location->delete();

        $this->assertSoftDeleted($location);
    }
}
