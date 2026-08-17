<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Models\Sales\Customer;
use App\Services\Asset\AssetMovementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetMovementServiceRentalSaleTest extends TestCase {
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

    private function makeLine(): DeliveryNoteItemAsset {
        $customer = Customer::query()->create([
            'name'        => fake()->unique()->company(),
            'is_disabled' => false,
        ]);

        $line = DeliveryNoteItemAsset::factory()->create();
        $line->deliveryNoteItem->deliveryNote->update([
            'customer_id'        => $customer->id,
            'customer_branch_id' => null,
        ]);

        return $line->fresh();
    }

    #[Test]
    public function creates_asset_movement_with_approved_status_directly(): void {
        $line = $this->makeLine();

        $movement = (new AssetMovementService)->createFromRentalSale($line, AssetMovementPurpose::RENT_OUT);

        $this->assertEqualsCanonicalizing([FormStatus::APPROVED], $movement->status);
        $this->assertSame(AssetMovementPurpose::RENT_OUT, $movement->purpose);
    }

    #[Test]
    public function creates_asset_movement_referencing_delivery_note(): void {
        $line = $this->makeLine();

        $movement = (new AssetMovementService)->createFromRentalSale($line, AssetMovementPurpose::SELL);

        $this->assertSame($line->deliveryNoteItem->deliveryNote->id, $movement->reference_id);
        $this->assertSame(DeliveryNote::class, $movement->reference_type);
    }

    #[Test]
    public function creates_asset_movement_item_with_customer_from_delivery_note(): void {
        $line = $this->makeLine();

        $movement = (new AssetMovementService)->createFromRentalSale($line, AssetMovementPurpose::RENT_OUT);

        $item = $movement->items()->first();
        $this->assertSame($line->asset_id, $item->asset_id);
        $this->assertEqualsWithDelta((float) $line->quantity, (float) $item->quantity, 0.0001);
        $this->assertSame($line->deliveryNoteItem->deliveryNote->customer_id, $item->customer_id);
    }
}
