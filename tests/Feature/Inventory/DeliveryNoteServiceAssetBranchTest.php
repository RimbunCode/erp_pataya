<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DeliveryNoteServiceAssetBranchTest extends TestCase {
    use RefreshDatabase;

    private function makeSalesOrder(bool $isRent): SalesOrder {
        SalesOrder::initPermissions();

        return SalesOrder::create([
            'code'        => fake()->unique()->bothify('SO-####'),
            'date'        => now(),
            'is_rent'     => $isRent,
            'customer_id' => Customer::query()->create([
                'name'        => fake()->unique()->company(),
                'is_disabled' => false,
            ])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);
    }

    private function makeFixedAssetItemVariant(string $itemId): ItemVariant {
        return ItemVariant::factory()->create(['item_id' => $itemId]);
    }

    private function makeDeliveryNoteWithAssetLine(bool $isRent, Asset $asset, ?DeliveryNote $returnAgainst = null): DeliveryNote {
        DeliveryNote::initPermissions();
        $salesOrder  = $this->makeSalesOrder($isRent);
        $itemVariant = $this->makeFixedAssetItemVariant($asset->item_id);

        $soItem = SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $itemVariant->id,
            'quantity'       => 1,
            'price'          => 0,
        ]);

        $deliveryNote = DeliveryNote::create([
            'code'            => fake()->unique()->bothify('DN-####'),
            'delivery_date'   => now(),
            'reference_to_id' => Permission::create([
                'module' => 'inventory',
                'name'   => 'dn_' . fake()->unique()->numerify('####'),
                'model'  => DeliveryNote::class,
            ])->id,
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $salesOrder->id,
            'created_by_id'      => $salesOrder->created_by_id,
            'return_against_id'  => $returnAgainst?->id,
        ]);

        $dnItem = DeliveryNoteItem::create([
            'delivery_note_id'   => $deliveryNote->id,
            'item_id'            => $itemVariant->id,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 1,
            'valuation_rates'    => [],
        ]);

        DeliveryNoteItemAsset::factory()->create([
            'delivery_note_item_id' => $dnItem->id,
            'asset_id'              => $asset->id,
            'quantity'              => 1,
        ]);

        return $deliveryNote;
    }

    #[Test]
    public function dn_approve_rental_increments_asset_rental_quantity_without_stock_ledger(): void {
        $item     = Item::factory()->create(['is_fixed_asset' => true]);
        $category = AssetCategory::factory()->rentable()->create();
        $asset    = Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->id, 'status' => [FormStatus::ACTIVE]]);

        $deliveryNote = $this->makeDeliveryNoteWithAssetLine(true, $asset);

        (new DeliveryNoteService)->onApproved($deliveryNote->fresh());

        $asset->refresh();
        $this->assertEqualsWithDelta(1.0, $asset->rental_quantity, 0.0001);
        $this->assertContains(FormStatus::IN_RENT, $asset->status);
        $this->assertSame(0, StockLedgerEntry::where('referenceable_type', DeliveryNote::class)
            ->where('referenceable_id', $deliveryNote->id)
            ->count());
    }

    #[Test]
    public function dn_approve_sell_increments_asset_sold_quantity(): void {
        $item     = Item::factory()->create(['is_fixed_asset' => true]);
        $category = AssetCategory::factory()->rentable()->create();
        $asset    = Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->id, 'status' => [FormStatus::ACTIVE]]);

        $deliveryNote = $this->makeDeliveryNoteWithAssetLine(false, $asset);

        (new DeliveryNoteService)->onApproved($deliveryNote->fresh());

        $asset->refresh();
        $this->assertEqualsWithDelta(1.0, $asset->sold_quantity, 0.0001);
        $this->assertContains(FormStatus::SOLD, $asset->status);
    }

    #[Test]
    public function dn_approve_rejects_non_rentable_asset_category(): void {
        $item     = Item::factory()->create(['is_fixed_asset' => true]);
        $category = AssetCategory::factory()->create(['is_rentable' => false]);
        $asset    = Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->id, 'status' => [FormStatus::ACTIVE]]);

        $deliveryNote = $this->makeDeliveryNoteWithAssetLine(true, $asset);

        $this->expectException(\LogicException::class);
        (new DeliveryNoteService)->onApproved($deliveryNote->fresh());
    }
}
