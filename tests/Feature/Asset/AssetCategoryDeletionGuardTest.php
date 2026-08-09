<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetCategoryDeletionGuardTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function cannot_force_delete_category_still_referenced_by_asset(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_location_id' => $location->id,
        ]);

        // FK restrictOnDelete blocks forceDelete; soft-delete is always allowed
        $this->expectException(QueryException::class);

        $category->forceDelete();
    }

    #[Test]
    public function can_delete_category_with_no_assets(): void {
        $category = AssetCategory::factory()->create();

        $category->delete();

        $this->assertSoftDeleted($category);
    }
}
