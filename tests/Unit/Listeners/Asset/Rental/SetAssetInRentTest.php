<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Listeners\Asset\Rental\SetAssetInRent;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Services\Asset\AssetMovementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SetAssetInRentTest extends TestCase {
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
    public function handle_adds_rented_quantity_and_marks_processed(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $line  = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new SetAssetInRent(app(AssetMovementService::class)))->handle(new AssetRentalDeliveryApproved($line));

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

        (new SetAssetInRent(app(AssetMovementService::class)))->handle(new AssetRentalDeliveryApproved($line));

        $asset->refresh();
        $this->assertEqualsWithDelta(0.0, $asset->rental_quantity, 0.0001);
        $this->assertSame(0, AssetMovement::where('purpose', AssetMovementPurpose::RENT_OUT)->count());
    }

    #[Test]
    public function handle_creates_asset_movement_rent_out(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $line  = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new SetAssetInRent(app(AssetMovementService::class)))->handle(new AssetRentalDeliveryApproved($line));

        $movement = AssetMovement::where('purpose', AssetMovementPurpose::RENT_OUT)->first();
        $this->assertNotNull($movement);
        $this->assertEqualsCanonicalizing([FormStatus::APPROVED], $movement->status);
        $this->assertNotNull($asset->activeRenter());
    }
}
