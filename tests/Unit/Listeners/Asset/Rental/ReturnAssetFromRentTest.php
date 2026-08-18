<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetRentalReturnApproved;
use App\Listeners\Asset\Rental\ReturnAssetFromRent;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Services\Asset\AssetMovementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReturnAssetFromRentTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, Asset::class, AssetMovement::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    #[Test]
    public function handle_removes_rented_quantity_and_marks_processed(): void {
        $asset = Asset::factory()->create([
            'asset_quantity'  => 1,
            'status'          => [FormStatus::IN_RENT],
            'rental_quantity' => 1,
        ]);
        $line = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new ReturnAssetFromRent(app(AssetMovementService::class)))->handle(new AssetRentalReturnApproved($line));

        $asset->refresh();
        $line->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
        $this->assertNotNull($line->processed_at);
    }

    #[Test]
    public function handle_creates_asset_movement_return_from_rent(): void {
        $asset = Asset::factory()->create([
            'asset_quantity'  => 1,
            'status'          => [FormStatus::IN_RENT],
            'rental_quantity' => 1,
        ]);
        $line = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new ReturnAssetFromRent(app(AssetMovementService::class)))->handle(new AssetRentalReturnApproved($line));

        $movement = AssetMovement::where('purpose', AssetMovementPurpose::RETURN_FROM_RENT)->first();
        $this->assertNotNull($movement);
        $this->assertEqualsCanonicalizing([FormStatus::APPROVED], $movement->status);
    }
}
