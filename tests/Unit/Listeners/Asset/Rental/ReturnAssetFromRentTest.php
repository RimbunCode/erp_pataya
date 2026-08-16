<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\FormStatus;
use App\Events\Asset\AssetRentalReturnApproved;
use App\Listeners\Asset\Rental\ReturnAssetFromRent;
use App\Models\Asset\Asset;
use App\Models\Inventory\DeliveryNoteItemAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReturnAssetFromRentTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function handle_removes_rented_quantity_and_marks_processed(): void {
        $asset = Asset::factory()->create([
            'asset_quantity'  => 1,
            'status'          => [FormStatus::IN_RENT],
            'rental_quantity' => 1,
        ]);
        $line = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new ReturnAssetFromRent)->handle(new AssetRentalReturnApproved($line));

        $asset->refresh();
        $line->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
        $this->assertNotNull($line->processed_at);
    }
}
