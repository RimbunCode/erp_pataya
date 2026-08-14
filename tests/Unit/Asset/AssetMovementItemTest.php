<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetLocation;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMovementItemTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_movement_returns_belongs_to_relation(): void {
        $item = new AssetMovementItem;

        $this->assertInstanceOf(BelongsTo::class, $item->assetMovement());
        $this->assertInstanceOf(AssetMovement::class, $item->assetMovement()->getRelated());
    }

    #[Test]
    public function asset_returns_belongs_to_relation(): void {
        $item = new AssetMovementItem;

        $this->assertInstanceOf(BelongsTo::class, $item->asset());
        $this->assertInstanceOf(Asset::class, $item->asset()->getRelated());
    }

    #[Test]
    public function source_location_returns_belongs_to_relation(): void {
        $item = new AssetMovementItem;

        $this->assertInstanceOf(BelongsTo::class, $item->sourceLocation());
        $this->assertInstanceOf(AssetLocation::class, $item->sourceLocation()->getRelated());
        $this->assertSame('source_location_id', $item->sourceLocation()->getForeignKeyName());
    }

    #[Test]
    public function target_location_returns_belongs_to_relation(): void {
        $item = new AssetMovementItem;

        $this->assertInstanceOf(BelongsTo::class, $item->targetLocation());
        $this->assertInstanceOf(AssetLocation::class, $item->targetLocation()->getRelated());
        $this->assertSame('target_location_id', $item->targetLocation()->getForeignKeyName());
    }

    #[Test]
    public function from_custodian_returns_belongs_to_relation(): void {
        $item = new AssetMovementItem;

        $this->assertInstanceOf(BelongsTo::class, $item->fromCustodian());
        $this->assertInstanceOf(User::class, $item->fromCustodian()->getRelated());
        $this->assertSame('from_custodian_id', $item->fromCustodian()->getForeignKeyName());
    }

    #[Test]
    public function to_custodian_returns_belongs_to_relation(): void {
        $item = new AssetMovementItem;

        $this->assertInstanceOf(BelongsTo::class, $item->toCustodian());
        $this->assertInstanceOf(User::class, $item->toCustodian()->getRelated());
        $this->assertSame('to_custodian_id', $item->toCustodian()->getForeignKeyName());
    }
}
