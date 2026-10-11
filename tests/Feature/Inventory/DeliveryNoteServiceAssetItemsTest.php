<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Events\Asset\AssetSoldViaDelivery;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Inventory\DeliveryNoteService;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * DeliveryNoteService menyimpan satu `items[]` berisi baris SO (referenceable) dan baris
 * bebas (ItemVariant/Asset tanpa sumber SO) ke delivery_note_items, dan memprosesnya saat approve.
 */
class DeliveryNoteServiceAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;
    private SalesOrder $salesOrder;
    private string $warehouseId;
    private string $referenceToId;

    protected function setUp(): void {
        parent::setUp();

        foreach ([User::class, FormatingSeries::class, DeliveryNote::class, Asset::class, SalesOrder::class, StockLedgerEntry::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        $this->user->branches()->attach($this->branch->id);
        Auth::login($this->user);

        $this->warehouseId   = WarehouseFactory::new()->create()->id;
        $this->referenceToId = Permission::create([
            'module' => 'inventory',
            'name'   => 'dn_' . fake()->unique()->numerify('####'),
            'model'  => SalesOrder::class,
        ])->id;

        $this->salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id,
            'created_by_id' => $this->user->id,
        ]);
    }

    private function makeSalesOrderItem(Item $item, ?Asset $asset = null): SalesOrderItem {
        $variant = $asset ? null : ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => $item->is_stock_item]);

        return SalesOrderItem::create([
            'sales_order_id' => $this->salesOrder->id,
            'item_id'        => $variant?->id,
            'asset_id'       => $asset?->id,
            'quantity'       => 5,
            'price'          => 0,
        ]);
    }

    private function makeItemUnit(string $itemId): string {
        $unitMasterId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'                => $unitMasterId,
            'code'              => 'PCS-' . $unitMasterId,
            'name'              => 'PCS',
            'conversion_factor' => 1,
            'is_default'        => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => $itemId,
            'unit_id'           => $unitMasterId,
            'conversion_factor' => 1,
            'is_default'        => true,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $itemUnitId;
    }

    private function makeAsset(Item $item, bool $rentable = true): Asset {
        $category = AssetCategory::factory()->create();

        $asset = $rentable
            ? Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $item->id])
            : Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->id, 'is_rentable' => false]);
        $asset->forceFill(['status' => [FormStatus::ACTIVE]])->save();

        return $asset;
    }

    /**
     * Baris dari SO (referenceable).
     *
     * @return array<string,mixed>
     */
    private function row(SalesOrderItem $soItem, Item $item, array $extra = [], ?string $id = null): array {
        return [
            'id' => $id ?? (string) Str::ulid(),
            ...($soItem->asset_id ? [] : ['unit' => ['id' => $this->makeItemUnit($item->id)]]),
            ...($soItem->asset_id ? [] : ['source_warehouse' => ['id' => $this->warehouseId]]),
            'quantity'           => 1,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            ...($soItem->asset_id ? ['asset' => ['id' => $soItem->asset_id]] : []),
            ...$extra,
        ];
    }

    /**
     * Baris bebas ItemVariant (tanpa sumber SO).
     *
     * @return array<string,mixed>
     */
    private function freeItemRow(ItemVariant $variant, string $itemUnitId, float $quantity = 2): array {
        return [
            'id'               => (string) Str::ulid(),
            'item'             => ['id' => $variant->id],
            'quantity'         => $quantity,
            'unit'             => ['id' => $itemUnitId],
            'source_warehouse' => ['id' => $this->warehouseId],
        ];
    }

    /**
     * Baris bebas Asset (tanpa sumber SO).
     *
     * @return array<string,mixed>
     */
    private function freeAssetRow(Asset $asset): array {
        return ['id' => (string) Str::ulid(), 'asset' => ['id' => $asset->id], 'quantity' => 1];
    }

    /**
     * @return array{0: ItemVariant, 1: string} [variant, itemUnitId]
     */
    private function makeStockedVariant(float $stockQuantity = 10): array {
        $item     = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $variant  = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $itemUnit = $this->makeItemUnit($item->id);
        Stock::create([
            'item_variant_id'   => $variant->id,
            'warehouse_id'      => $this->warehouseId,
            'item_unit_id'      => $itemUnit,
            'quantity'          => $stockQuantity,
            'conversion_factor' => 1,
            'stock_queue'       => [['quantity' => $stockQuantity, 'rate' => 1000]],
        ]);

        return [$variant, $itemUnit];
    }

    /**
     * @param  array<string,mixed>  $lists
     * @return array<string,mixed>
     */
    private function payload(array $lists): array {
        return [
            'delivery_date'      => now()->toDateString(),
            'reference_to'       => ['id' => $this->referenceToId],
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $this->salesOrder->id,
            'customer'           => ['id' => $this->salesOrder->customer_id],
            'customer_branch'    => ['id' => $this->branch->id],
            'branch_id'          => $this->branch->id,
            // BaseFormRequest::validated() menambahkan `branch` di alur HTTP; FormatingSeries
            // membutuhkannya untuk token @[branch_code] saat generate kode dokumen.
            'branch'        => ['code' => $this->branch->code, 'name' => $this->branch->name],
            'created_by_id' => $this->user->id,
            ...$lists,
        ];
    }

    #[Test]
    public function create_saves_regular_and_asset_rows_with_mutually_exclusive_ids(): void {
        $regularItem = Item::factory()->create(['is_fixed_asset' => false]);
        $assetItem   = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $asset       = $this->makeAsset($assetItem);
        $regularSo   = $this->makeSalesOrderItem($regularItem);
        $assetSo     = $this->makeSalesOrderItem($assetItem, $asset);

        $deliveryNote = app(DeliveryNoteService::class)->create($this->payload([
            'items' => [$this->row($regularSo, $regularItem), $this->row($assetSo, $assetItem)],
        ]))->fresh(['items.asset']);

        $this->assertCount(2, $deliveryNote->items, 'relasi items() mengembalikan semua baris');

        $assetRow   = $deliveryNote->items->firstWhere('referenceable_id', $assetSo->id);
        $regularRow = $deliveryNote->items->firstWhere('referenceable_id', $regularSo->id);

        $this->assertNull($assetRow->item_id);
        $this->assertSame($asset->id, $assetRow->asset_id);
        $this->assertSame($asset->id, $assetRow->asset->id);
        $this->assertNull($assetRow->item_unit_id);
        $this->assertSame(1.0, $assetRow->conversion_factor);
        $this->assertNotNull($regularRow->item_id);
        $this->assertNull($regularRow->asset_id);
    }

    #[Test]
    public function update_replaces_asset_identity_from_the_selected_source_item(): void {
        $assetItem = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $assetA    = $this->makeAsset($assetItem);
        $assetB    = $this->makeAsset($assetItem);
        $assetSoA  = $this->makeSalesOrderItem($assetItem, $assetA);
        $assetSoB  = $this->makeSalesOrderItem($assetItem, $assetB);
        $service   = app(DeliveryNoteService::class);

        $deliveryNote = $service->create($this->payload([
            'items' => [$this->row($assetSoA, $assetItem)],
        ]));
        $existing = $deliveryNote->items()->first();

        $service->update($deliveryNote->fresh(), $this->payload([
            'items' => [$this->row($assetSoB, $assetItem, [], $existing->id)],
        ]));

        $updated = $deliveryNote->items()->first()->fresh();
        $this->assertSame($assetSoB->id, $updated->referenceable_id);
        $this->assertSame($assetB->id, $updated->asset_id);
        $this->assertNull($updated->item_id);
        $this->assertSame(1, $deliveryNote->items()->count());
    }

    #[Test]
    public function create_with_only_regular_rows_behaves_as_before(): void {
        $regularItem = Item::factory()->create(['is_fixed_asset' => false]);
        $regularSo   = $this->makeSalesOrderItem($regularItem);

        $deliveryNote = app(DeliveryNoteService::class)->create($this->payload([
            'items' => [$this->row($regularSo, $regularItem)],
        ]))->fresh(['items']);

        $this->assertCount(1, $deliveryNote->items);
        $this->assertNotNull($deliveryNote->items->first()->item_id);
        $this->assertNull($deliveryNote->items->first()->asset_id);
    }

    #[Test]
    public function approval_dispatches_once_for_each_asset_document_row(): void {
        $this->salesOrder->update(['is_rent' => true]);
        $assetItem    = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $assetA       = $this->makeAsset($assetItem);
        $assetB       = $this->makeAsset($assetItem);
        $sourceA      = $this->makeSalesOrderItem($assetItem, $assetA);
        $sourceB      = $this->makeSalesOrderItem($assetItem, $assetB);
        $service      = app(DeliveryNoteService::class);
        $deliveryNote = $service->create($this->payload([
            'items' => [
                $this->row($sourceA, $assetItem),
                $this->row($sourceB, $assetItem),
            ],
        ]));
        $itemIds = $deliveryNote->items()->pluck('id')->all();

        Event::fake();
        $service->onApproved($deliveryNote->fresh());

        Event::assertDispatchedTimes(AssetRentalDeliveryApproved::class, 2);
        foreach ([$assetA->id, $assetB->id] as $assetId) {
            Event::assertDispatched(
                AssetRentalDeliveryApproved::class,
                fn (AssetRentalDeliveryApproved $event) => $event->line instanceof DeliveryNoteItem
                    && in_array($event->line->id, $itemIds, true)
                    && $event->line->asset_id === $assetId,
            );
        }
    }

    // --- baris bebas (spec delivery-note-sales-invoice-off-source-items) ----

    #[Test]
    public function create_saves_free_rows_without_referenceable(): void {
        [$variant, $itemUnit] = $this->makeStockedVariant();
        $asset                = $this->makeAsset(Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]));

        $deliveryNote = app(DeliveryNoteService::class)->create($this->payload([
            'items' => [$this->freeItemRow($variant, $itemUnit), $this->freeAssetRow($asset)],
        ]))->fresh(['items']);

        $itemRow  = $deliveryNote->items->firstWhere('item_id', $variant->id);
        $assetRow = $deliveryNote->items->firstWhere('asset_id', $asset->id);

        $this->assertNull($itemRow->referenceable_id);
        $this->assertNull($itemRow->referenceable_type);
        $this->assertNull($itemRow->asset_id);
        $this->assertSame($itemUnit, $itemRow->item_unit_id);
        $this->assertSame($this->warehouseId, $itemRow->source_warehouse_id);
        $this->assertNull($assetRow->referenceable_id);
        $this->assertNull($assetRow->item_id);
        $this->assertNull($assetRow->item_unit_id);
        $this->assertSame(1.0, $assetRow->conversion_factor);
    }

    #[Test]
    public function approving_a_free_item_row_deducts_stock_without_touching_the_sales_order(): void {
        [$variant, $itemUnit] = $this->makeStockedVariant(10);
        $regularItem          = Item::factory()->create(['is_fixed_asset' => false]);
        $regularSo            = $this->makeSalesOrderItem($regularItem);

        $deliveryNote = app(DeliveryNoteService::class)->create($this->payload([
            'items' => [$this->freeItemRow($variant, $itemUnit, 3)],
        ]));

        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class, DocumentDeliveryStatusRecalculationRequested::class]);
        app(DeliveryNoteService::class)->onApproved($deliveryNote->fresh());

        $stock = Stock::where('item_variant_id', $variant->id)->first();
        $this->assertEqualsWithDelta(7.0, $stock->quantity, 0.0001);
        $entry = StockLedgerEntry::where('referenceable_type', DeliveryNote::class)
            ->where('referenceable_id', $deliveryNote->id)->first();
        $this->assertEqualsWithDelta(-3.0, (float) $entry->quantity_change, 0.0001);
        $this->assertEqualsWithDelta(0.0, (float) $regularSo->fresh()->delivered_quantity, 0.0001, 'baris SO lain tidak tersentuh');
    }

    #[Test]
    public function returning_a_free_item_row_restores_stock_using_the_original_valuation(): void {
        [$variant, $itemUnit] = $this->makeStockedVariant(10);
        $service              = app(DeliveryNoteService::class);

        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class, DocumentDeliveryStatusRecalculationRequested::class]);
        $original = $service->create($this->payload([
            'items' => [$this->freeItemRow($variant, $itemUnit, 3)],
        ]));
        $service->onApproved($original->fresh());
        $originalRow = $original->items()->first();

        $return = $service->create($this->payload([
            'return_against' => ['id' => $original->id],
            'items'          => [[
                ...$this->freeItemRow($variant, $itemUnit, 3),
                'return_against_item' => ['id' => $originalRow->id],
            ]],
        ]));
        $service->onApproved($return->fresh());

        $this->assertEqualsWithDelta(10.0, Stock::where('item_variant_id', $variant->id)->first()->quantity, 0.0001);
        $this->assertEqualsWithDelta(3.0, (float) $originalRow->fresh()->returned_quantity, 0.0001);
    }

    #[Test]
    public function approving_a_free_item_row_with_insufficient_stock_does_not_deduct_stock(): void {
        [$variant, $itemUnit] = $this->makeStockedVariant(1);

        $deliveryNote = app(DeliveryNoteService::class)->create($this->payload([
            'items' => [$this->freeItemRow($variant, $itemUnit, 3)],
        ]));

        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class, DocumentDeliveryStatusRecalculationRequested::class]);
        try {
            app(DeliveryNoteService::class)->onApproved($deliveryNote->fresh());
        } catch (\Throwable) {
            // stok tidak cukup -> dokumen tidak boleh memotong stok
        }

        $this->assertEqualsWithDelta(1.0, Stock::where('item_variant_id', $variant->id)->first()->quantity, 0.0001);
    }

    #[Test]
    public function approving_a_free_asset_row_dispatches_asset_sold_even_for_a_non_rentable_asset(): void {
        $item  = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $asset = $this->makeAsset($item, false);

        $service      = app(DeliveryNoteService::class);
        $deliveryNote = $service->create($this->payload(['items' => [$this->freeAssetRow($asset)]]));

        Event::fake();
        $service->onApproved($deliveryNote->fresh());

        Event::assertDispatchedTimes(AssetSoldViaDelivery::class, 1);
        Event::assertNotDispatched(AssetRentalDeliveryApproved::class);
    }

    #[Test]
    public function approving_so_rows_and_free_rows_together_only_counts_so_rows_as_delivered(): void {
        $assetItem = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $assetA    = $this->makeAsset($assetItem);
        $soAsset   = $this->makeSalesOrderItem($assetItem, $assetA);
        $assetB    = $this->makeAsset($assetItem);

        $service      = app(DeliveryNoteService::class);
        $deliveryNote = $service->create($this->payload([
            'items' => [$this->row($soAsset, $assetItem), $this->freeAssetRow($assetB)],
        ]));

        Event::fake();
        $service->onApproved($deliveryNote->fresh());

        $this->assertEqualsWithDelta(1.0, (float) $soAsset->fresh()->delivered_quantity, 0.0001);
        Event::assertDispatchedTimes(AssetSoldViaDelivery::class, 2);
    }
}
