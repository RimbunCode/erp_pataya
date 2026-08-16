<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\FormStatus;
use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Listeners\Asset\Rental\SetAssetInRent;
use App\Models\Asset\Asset;
use App\Models\Inventory\DeliveryNoteItemAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SetAssetInRentTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function handle_adds_rented_quantity_and_marks_processed(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $line  = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new SetAssetInRent)->handle(new AssetRentalDeliveryApproved($line));

        $asset->refresh();
        $line->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::IN_RENT], $asset->status);
        $this->assertNotNull($line->processed_at);
    }

    #[Test]
    public function handle_is_idempotent_when_already_processed(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $line  = DeliveryNoteItemAsset::factory()->create([
            'asset_id'     => $asset->id,
            'quantity'     => 1,
            'processed_at' => now(),
        ]);

        (new SetAssetInRent)->handle(new AssetRentalDeliveryApproved($line));

        $asset->refresh();
        $this->assertEqualsWithDelta(0.0, $asset->rental_quantity, 0.0001);
    }
}
