<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetMovementPurpose;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use App\Models\Asset\AssetService;
use App\Models\Core\FormatingSeries;
use App\Models\Sales\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceBillToRenterTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, Asset::class, AssetMovement::class] as $model) {
            $model::initPermissions();
        }
    }

    private function makeRentedAsset(): Asset {
        $asset    = Asset::factory()->create();
        $customer = Customer::query()->create(['name' => fake()->unique()->company(), 'is_disabled' => false]);

        $movement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::RENT_OUT]);
        AssetMovementItem::factory()->create([
            'asset_movement_id'  => $movement->id,
            'asset_id'           => $asset->id,
            'customer_id'        => $customer->id,
            'customer_branch_id' => null,
        ]);

        return $asset;
    }

    #[Test]
    public function throws_when_asset_not_currently_rented(): void {
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create(['asset_id' => $asset->id]);

        $this->expectException(LogicException::class);
        $service->billToRenter();
    }

    #[Test]
    public function sets_bill_to_renter_and_snapshots_customer(): void {
        $asset   = $this->makeRentedAsset();
        $service = AssetService::factory()->create(['asset_id' => $asset->id]);

        $service->billToRenter();
        $service->refresh();

        $renter = $asset->activeRenter();
        $this->assertTrue($service->bill_to_renter);
        $this->assertSame($renter->customer_id, $service->customer_id);
        $this->assertSame($renter->customer_branch_id, $service->customer_branch_id);
    }

    #[Test]
    public function snapshot_does_not_change_after_asset_rental_status_changes(): void {
        $asset   = $this->makeRentedAsset();
        $service = AssetService::factory()->create(['asset_id' => $asset->id]);

        $service->billToRenter();
        $service->refresh();
        $snapshotCustomerId = $service->customer_id;

        // Asset diretur, lalu disewa customer lain
        $returnMovement = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::RETURN_FROM_RENT]);
        AssetMovementItem::factory()->create(['asset_movement_id' => $returnMovement->id, 'asset_id' => $asset->id]);

        $newCustomer = Customer::query()->create(['name' => fake()->unique()->company(), 'is_disabled' => false]);
        $rentAgain   = AssetMovement::factory()->create(['purpose' => AssetMovementPurpose::RENT_OUT]);
        AssetMovementItem::factory()->create([
            'asset_movement_id' => $rentAgain->id,
            'asset_id'          => $asset->id,
            'customer_id'       => $newCustomer->id,
        ]);

        $service->refresh();
        $this->assertSame($snapshotCustomerId, $service->customer_id);
        $this->assertNotSame($newCustomer->id, $service->customer_id);
    }
}
