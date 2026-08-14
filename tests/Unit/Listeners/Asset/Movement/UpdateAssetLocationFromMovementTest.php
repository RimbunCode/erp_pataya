<?php

namespace Tests\Unit\Listeners\Asset\Movement;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetMovementApproved;
use App\Listeners\Asset\Movement\UpdateAssetLocationFromMovement;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetLocation;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class UpdateAssetLocationFromMovementTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function transfer_updates_location_and_custodian_without_changing_status(): void {
        $targetLocation = AssetLocation::factory()->create();
        $toCustodian    = User::factory()->create();
        $asset          = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::TRANSFER]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'target_location_id' => $targetLocation->id,
            'to_custodian_id'    => $toCustodian->id,
        ]);

        (new UpdateAssetLocationFromMovement)->handle(new AssetMovementApproved($movement->fresh(['items'])));

        $asset->refresh();
        $this->assertSame($targetLocation->id, $asset->asset_location_id);
        $this->assertSame($toCustodian->id, $asset->custodian_id);
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
    }

    #[Test]
    public function issue_adds_issued_status_without_removing_active(): void {
        $targetLocation = AssetLocation::factory()->create();
        $asset          = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::ISSUE]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'target_location_id' => $targetLocation->id,
        ]);

        (new UpdateAssetLocationFromMovement)->handle(new AssetMovementApproved($movement->fresh(['items'])));

        $asset->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE, FormStatus::ISSUED], $asset->status);
    }

    #[Test]
    public function transfer_and_issue_adds_issued_status(): void {
        $targetLocation = AssetLocation::factory()->create();
        $asset          = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::TRANSFER_AND_ISSUE]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'target_location_id' => $targetLocation->id,
        ]);

        (new UpdateAssetLocationFromMovement)->handle(new AssetMovementApproved($movement->fresh(['items'])));

        $asset->refresh();
        $this->assertContains(FormStatus::ISSUED, $asset->status);
    }

    #[Test]
    public function receipt_removes_issued_status(): void {
        $sourceLocation = AssetLocation::factory()->create();
        $asset          = Asset::factory()->create(['status' => [FormStatus::ACTIVE, FormStatus::ISSUED]]);

        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::RECEIPT]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'source_location_id' => $sourceLocation->id,
            'target_location_id' => $asset->asset_location_id,
        ]);

        (new UpdateAssetLocationFromMovement)->handle(new AssetMovementApproved($movement->fresh(['items'])));

        $asset->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
    }

    #[Test]
    public function handles_multiple_items_in_one_movement(): void {
        $targetLocation = AssetLocation::factory()->create();
        $assetOne       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $assetTwo       = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::TRANSFER]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $assetOne->id,
            'target_location_id' => $targetLocation->id,
        ]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $assetTwo->id,
            'target_location_id' => $targetLocation->id,
        ]);

        (new UpdateAssetLocationFromMovement)->handle(new AssetMovementApproved($movement->fresh(['items'])));

        $this->assertSame($targetLocation->id, $assetOne->refresh()->asset_location_id);
        $this->assertSame($targetLocation->id, $assetTwo->refresh()->asset_location_id);
    }
}
