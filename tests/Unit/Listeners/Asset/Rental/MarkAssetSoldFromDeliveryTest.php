<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaDelivery;
use App\Listeners\Asset\Rental\MarkAssetSoldFromDelivery;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Services\Asset\AssetMovementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MarkAssetSoldFromDeliveryTest extends TestCase {
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
    public function handle_adds_sold_quantity_without_gain_loss(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $line  = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new MarkAssetSoldFromDelivery(app(AssetMovementService::class)))->handle(new AssetSoldViaDelivery($line));

        $asset->refresh();
        $line->refresh();
        $this->assertEqualsCanonicalizing([FormStatus::SOLD], $asset->status);
        $this->assertEqualsWithDelta(1.0, $asset->sold_quantity, 0.0001);
        $this->assertNotNull($line->processed_at);
    }

    #[Test]
    public function handle_creates_asset_movement_sell(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $line  = DeliveryNoteItemAsset::factory()->create(['asset_id' => $asset->id, 'quantity' => 1]);

        (new MarkAssetSoldFromDelivery(app(AssetMovementService::class)))->handle(new AssetSoldViaDelivery($line));

        $movement = AssetMovement::where('purpose', AssetMovementPurpose::SELL)->first();
        $this->assertNotNull($movement);
        $this->assertEqualsCanonicalizing([FormStatus::APPROVED], $movement->status);
    }
}
