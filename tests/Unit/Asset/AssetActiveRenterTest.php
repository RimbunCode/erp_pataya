<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetMovementPurpose;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetActiveRenterTest extends TestCase {
    use RefreshDatabase;

    private function makeMovementItem(Asset $asset, AssetMovementPurpose $purpose): AssetMovementItem {
        $movement = AssetMovement::factory()->create(['purpose' => $purpose]);

        return AssetMovementItem::factory()->create([
            'asset_movement_id' => $movement->id,
            'asset_id'          => $asset->id,
        ]);
    }

    #[Test]
    public function returns_null_when_asset_never_rented(): void {
        $asset = Asset::factory()->create();

        $this->assertNull($asset->activeRenter());
    }

    #[Test]
    public function returns_null_when_rent_out_already_returned(): void {
        $asset = Asset::factory()->create();

        $this->makeMovementItem($asset, AssetMovementPurpose::RENT_OUT);
        $this->makeMovementItem($asset, AssetMovementPurpose::RETURN_FROM_RENT);

        $this->assertNull($asset->activeRenter());
    }

    #[Test]
    public function returns_latest_rent_out_when_rented_again_after_return(): void {
        $asset = Asset::factory()->create();

        $this->makeMovementItem($asset, AssetMovementPurpose::RENT_OUT);
        $this->makeMovementItem($asset, AssetMovementPurpose::RETURN_FROM_RENT);
        $latestRentOut = $this->makeMovementItem($asset, AssetMovementPurpose::RENT_OUT);

        $activeRenter = $asset->activeRenter();

        $this->assertNotNull($activeRenter);
        $this->assertTrue($activeRenter->is($latestRentOut));
    }

    #[Test]
    public function returns_rent_out_when_currently_rented(): void {
        $asset   = Asset::factory()->create();
        $rentOut = $this->makeMovementItem($asset, AssetMovementPurpose::RENT_OUT);

        $activeRenter = $asset->activeRenter();

        $this->assertNotNull($activeRenter);
        $this->assertTrue($activeRenter->is($rentOut));
    }
}
