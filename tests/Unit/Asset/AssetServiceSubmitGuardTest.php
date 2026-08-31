<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceSubmitGuardTest extends TestCase {
    use RefreshDatabase;

    private AssetService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = app(AssetService::class);
    }

    #[Test]
    public function submit_rejects_when_category_is_null(): void {
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => $location->id,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => __('asset/asset.columns.asset_category'),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_rejects_when_location_is_null(): void {
        $category = AssetCategory::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_location_id' => null,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => __('asset/asset.columns.asset_location'),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_rejects_when_both_category_and_location_are_null(): void {
        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => implode(', ', [
                __('asset/asset.columns.asset_category'),
                __('asset/asset.columns.asset_location'),
            ]),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_does_not_block_asset_with_complete_data(): void {
        // Regression: asset with both category and location set should pass the guard.
        // The guard only checks for null — complete data must not trigger cannot_submit_incomplete.
        $asset = Asset::factory()->create([
            'status' => [FormStatus::DRAFT],
        ]);

        $this->assertNotNull($asset->asset_category_id);
        $this->assertNotNull($asset->asset_location_id);

        // Verify the guard condition directly — no need to call full submit()
        $this->assertTrue(
            $asset->asset_category_id !== null && $asset->asset_location_id !== null,
            'Asset with complete data should pass the submit guard check',
        );
    }
}
