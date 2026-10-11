<?php

namespace Tests\Feature\Inventory;

use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
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
 * DeliveryNoteService menggabungkan bucket ke delivery_note_items dan
 * menyimpan asset_id langsung sambil mempertahankan referenceable source row.
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

        foreach ([User::class, FormatingSeries::class, DeliveryNote::class, Asset::class, SalesOrder::class] as $model) {
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

    private function makeAsset(Item $item): Asset {
        $category = AssetCategory::factory()->create();

        return Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $item->id]);
    }

    /**
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
            'items'       => [$this->row($regularSo, $regularItem)],
            'asset_items' => [$this->row($assetSo, $assetItem)],
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
            'asset_items' => [$this->row($assetSoA, $assetItem)],
        ]));
        $existing = $deliveryNote->items()->first();

        $service->update($deliveryNote->fresh(), $this->payload([
            'asset_items' => [$this->row($assetSoB, $assetItem, [], $existing->id)],
        ]));

        $updated = $deliveryNote->items()->first()->fresh();
        $this->assertSame($assetSoB->id, $updated->referenceable_id);
        $this->assertSame($assetB->id, $updated->asset_id);
        $this->assertNull($updated->item_id);
        $this->assertSame(1, $deliveryNote->items()->count());
    }

    #[Test]
    public function create_without_asset_items_behaves_as_before(): void {
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
            'asset_items' => [
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
}
