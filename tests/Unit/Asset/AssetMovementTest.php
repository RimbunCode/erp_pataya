<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetMovementPurpose;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use App\Models\Core\Branch;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMovementTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function items_returns_has_many_relation(): void {
        $movement = new AssetMovement;

        $this->assertInstanceOf(HasMany::class, $movement->items());
        $this->assertInstanceOf(AssetMovementItem::class, $movement->items()->getRelated());
    }

    #[Test]
    public function branch_returns_belongs_to_relation(): void {
        $movement = new AssetMovement;

        $this->assertInstanceOf(BelongsTo::class, $movement->branch());
        $this->assertInstanceOf(Branch::class, $movement->branch()->getRelated());
    }

    #[Test]
    public function purpose_casts_to_enum(): void {
        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::ISSUE]);

        $this->assertInstanceOf(AssetMovementPurpose::class, $movement->purpose);
        $this->assertSame(AssetMovementPurpose::ISSUE, $movement->purpose);
    }

    #[Test]
    public function items_relation_returns_created_rows(): void {
        $movement = AssetMovement::factory()->create();
        AssetMovementItem::factory()->count(2)->create(['asset_movement_id' => $movement->id]);

        $this->assertCount(2, $movement->items);
    }
}
