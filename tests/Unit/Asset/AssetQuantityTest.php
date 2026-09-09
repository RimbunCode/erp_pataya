<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetQuantityTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function available_quantity_computed_correctly(): void {
        $asset = Asset::factory()->bulkQuantity()->create([
            'asset_quantity'  => 10,
            'rental_quantity' => 3,
            'sold_quantity'   => 2,
        ]);

        $this->assertEqualsWithDelta(5.0, $asset->available_quantity, 0.0001);
    }

    #[Test]
    public function add_rented_quantity_qty_one_transitions_binary_to_in_rent(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);

        $asset->addRentedQuantity(1);

        $this->assertEqualsCanonicalizing([FormStatus::IN_RENT], $asset->status);
    }

    #[Test]
    public function add_rented_quantity_partial_keeps_active_and_adds_partially_rented(): void {
        $asset = Asset::factory()->bulkQuantity()->create([
            'asset_quantity' => 10,
            'status'         => [FormStatus::ACTIVE],
        ]);

        $asset->addRentedQuantity(4);

        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE, FormStatus::PARTIALLY_RENTED], $asset->status);
        $this->assertEqualsWithDelta(4.0, $asset->rental_quantity, 0.0001);
    }

    #[Test]
    public function add_rented_quantity_rejects_when_exceeding_available(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);

        $this->expectException(LogicException::class);
        $asset->addRentedQuantity(2);
    }

    #[Test]
    public function remove_rented_quantity_returns_to_active(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);
        $asset->addRentedQuantity(1);

        $asset->removeRentedQuantity(1);

        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE], $asset->status);
    }

    #[Test]
    public function add_sold_quantity_qty_one_sets_sold_and_disposal_date(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE], 'disposal_date' => null]);

        $asset->addSoldQuantity(1);

        $this->assertEqualsCanonicalizing([FormStatus::SOLD], $asset->status);
        $this->assertNotNull($asset->disposal_date);
    }

    #[Test]
    public function add_sold_quantity_partial_does_not_set_disposal_date(): void {
        $asset = Asset::factory()->bulkQuantity()->create([
            'asset_quantity' => 10,
            'status'         => [FormStatus::ACTIVE],
            'disposal_date'  => null,
        ]);

        $asset->addSoldQuantity(3);

        $this->assertEqualsCanonicalizing([FormStatus::ACTIVE, FormStatus::PARTIALLY_SOLD], $asset->status);
        $this->assertNull($asset->disposal_date);
    }

    #[Test]
    public function add_sold_quantity_rejects_when_exceeding_available(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);

        $this->expectException(LogicException::class);
        $asset->addSoldQuantity(2);
    }

    #[Test]
    public function sell_sells_all_remaining_available_quantity(): void {
        $asset = Asset::factory()->create(['asset_quantity' => 1, 'status' => [FormStatus::ACTIVE]]);

        $asset->sell();

        $this->assertEqualsCanonicalizing([FormStatus::SOLD], $asset->status);
        $this->assertEqualsWithDelta(1.0, $asset->sold_quantity, 0.0001);
    }

    #[Test]
    public function mixed_rental_and_sold_produce_combined_partial_statuses(): void {
        $asset = Asset::factory()->bulkQuantity()->create([
            'asset_quantity' => 10,
            'status'         => [FormStatus::ACTIVE],
        ]);

        $asset->addRentedQuantity(3);
        $asset->addSoldQuantity(2);

        $this->assertEqualsCanonicalizing(
            [FormStatus::ACTIVE, FormStatus::PARTIALLY_RENTED, FormStatus::PARTIALLY_SOLD],
            $asset->status,
        );
        $this->assertEqualsWithDelta(5.0, $asset->available_quantity, 0.0001);
    }
}
