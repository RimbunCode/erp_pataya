<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetMovementApproved;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetLocation;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use App\Services\Asset\AssetMovementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMovementServiceTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function submit_rejects_when_source_location_mismatches_asset_current_location(): void {
        $actualLocation = AssetLocation::factory()->create();
        $wrongLocation  = AssetLocation::factory()->create();
        $asset          = Asset::factory()->create([
            'status'            => [FormStatus::ACTIVE],
            'asset_location_id' => $actualLocation->id,
        ]);
        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::TRANSFER]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'source_location_id' => $wrongLocation->id,
            'target_location_id' => AssetLocation::factory()->create()->id,
        ]);

        $this->expectException(LogicException::class);
        (new AssetMovementService)->submit($movement->fresh(['items']));
    }

    #[Test]
    public function submit_rejects_when_asset_not_active(): void {
        $asset    = Asset::factory()->create(['status' => [FormStatus::DRAFT]]);
        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::TRANSFER]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'source_location_id' => $asset->asset_location_id,
            'target_location_id' => AssetLocation::factory()->create()->id,
        ]);

        $this->expectException(LogicException::class);
        (new AssetMovementService)->submit($movement->fresh(['items']));
    }

    #[Test]
    public function submit_rejects_transfer_without_both_locations(): void {
        $asset    = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::TRANSFER]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'source_location_id' => $asset->asset_location_id,
            'target_location_id' => null,
        ]);

        $this->expectException(LogicException::class);
        (new AssetMovementService)->submit($movement->fresh(['items']));
    }

    #[Test]
    public function submit_rejects_issue_without_target_location(): void {
        $asset    = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::ISSUE]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'target_location_id' => null,
        ]);

        $this->expectException(LogicException::class);
        (new AssetMovementService)->submit($movement->fresh(['items']));
    }

    #[Test]
    public function submit_rejects_receipt_without_source_location(): void {
        $asset    = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::RECEIPT]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'source_location_id' => null,
        ]);

        $this->expectException(LogicException::class);
        (new AssetMovementService)->submit($movement->fresh(['items']));
    }

    #[Test]
    public function on_approved_dispatches_event(): void {
        Event::fake([AssetMovementApproved::class]);

        $movement = AssetMovement::factory()->create(['status' => [FormStatus::SUBMITTED]]);

        (new AssetMovementService)->onApproved($movement);

        Event::assertDispatched(AssetMovementApproved::class, fn ($e) => $e->movement->is($movement));
    }
}
