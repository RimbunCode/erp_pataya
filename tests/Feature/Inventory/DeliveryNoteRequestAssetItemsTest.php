<?php

namespace Tests\Feature\Inventory;

use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec delivery-note-sales-invoice-off-source-items: DeliveryNoteRequest menerima satu
 * `items[]` dengan tiga sumber per baris -- baris SO, ItemVariant bebas, Asset bebas.
 */
class DeliveryNoteRequestAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private ItemVariant $freeVariant;
    private Asset $asset;
    private Asset $nonRentableAsset;
    private SalesOrderItem $regularSoItem;
    private SalesOrderItem $assetSoItem;
    private SalesOrderItem $nonRentableSoItem;
    private string $warehouseId;
    private string $unitId;

    protected function setUp(): void {
        parent::setUp();

        $regularItem = Item::factory()->create(['is_fixed_asset' => false]);
        $assetItem   = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);

        $this->asset            = $this->makeAsset($assetItem);
        $this->nonRentableAsset = $this->makeAsset($assetItem, false);
        $this->freeVariant      = ItemVariant::factory()->create(['item_id' => $regularItem->id, 'is_stock_item' => true]);
        $this->warehouseId      = WarehouseFactory::new()->create()->id;

        $unit         = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $this->unitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $this->unitId,
            'item_id'    => $regularItem->id,
            'unit_id'    => $unit->id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        $this->regularSoItem     = $this->makeSalesOrderItem($salesOrder, $this->freeVariant, null);
        $this->assetSoItem       = $this->makeSalesOrderItem($salesOrder, null, $this->asset);
        $this->nonRentableSoItem = $this->makeSalesOrderItem($salesOrder, null, $this->nonRentableAsset);
    }

    private function makeSalesOrderItem(SalesOrder $salesOrder, ?ItemVariant $variant, ?Asset $asset): SalesOrderItem {
        return SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $variant?->id,
            'asset_id'       => $asset?->id,
            'quantity'       => 5,
            'price'          => 0,
        ]);
    }

    private function makeAsset(Item $item, bool $rentable = true): Asset {
        $category = AssetCategory::factory()->create();

        return $rentable
            ? Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $item->id])
            : Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->id, 'is_rentable' => false]);
    }

    /**
     * @return array<string,mixed>
     */
    private function itemRules(DeliveryNoteRequest $request): array {
        return collect($request->rules())
            ->filter(fn ($rule, $key) => str_starts_with($key, 'items'))
            ->all();
    }

    private function validate(array $data): Validator {
        $data = ['reference_to' => ['model' => SalesOrder::class], ...$data];

        $request = DeliveryNoteRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $validator = ValidatorFacade::make($data, $this->itemRules($request));
        $request->withValidator($validator);

        return $validator;
    }

    /** Baris dari SO: ItemVariant (gudang + unit) atau Asset (tanpa keduanya). */
    private function soRow(SalesOrderItem $soItem, string $id, array $extra = []): array {
        return [
            'id'                 => $id,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            ...($soItem->asset_id
                ? ['asset' => ['id' => $soItem->asset_id]]
                : ['source_warehouse' => ['id' => $this->warehouseId], 'unit' => ['id' => $this->unitId]]),
            ...$extra,
        ];
    }

    private function freeItemRow(string $id = 'f1', array $extra = []): array {
        return [
            'id'               => $id,
            'item'             => ['id' => $this->freeVariant->id],
            'quantity'         => 2,
            'source_warehouse' => ['id' => $this->warehouseId],
            'unit'             => ['id' => $this->unitId],
            ...$extra,
        ];
    }

    private function freeAssetRow(Asset $asset, string $id = 'fa1', array $extra = []): array {
        return ['id' => $id, 'asset' => ['id' => $asset->id], 'quantity' => 1, ...$extra];
    }

    #[Test]
    public function missing_reference_to_is_a_validation_error_instead_of_a_rules_exception(): void {
        $request = DeliveryNoteRequest::create('/', 'POST');
        $request->setContainer(app());

        $validator = ValidatorFacade::make([], $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('reference_to.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rules_use_a_single_items_list_with_three_optional_sources(): void {
        $request = DeliveryNoteRequest::create('/', 'POST', ['reference_to' => ['model' => SalesOrder::class]]);
        $request->setContainer(app());
        $rules = $request->rules();

        $this->assertArrayNotHasKey('asset_items', $rules);
        $this->assertArrayNotHasKey('asset_items.*.asset.id', $rules);
        $this->assertContains('required_without_all:items.*.item.id,items.*.asset.id', $rules['items.*.referenceable_id']);
        $this->assertArrayHasKey('items.*.item.id', $rules);
        $this->assertArrayHasKey('items.*.asset.id', $rules);
        $this->assertContains('required', $rules['referenceable_id']);
    }

    #[Test]
    public function accepts_so_rows_and_free_rows_together(): void {
        $validator = $this->validate(['items' => [
            $this->soRow($this->regularSoItem, 'r1'),
            $this->soRow($this->assetSoItem, 'a1'),
            $this->freeItemRow(),
            $this->freeAssetRow($this->asset),
        ]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_row_without_any_source(): void {
        $validator = $this->validate(['items' => [['id' => 'x', 'quantity' => 1]]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.referenceable_id', $validator->errors()->toArray());
    }

    #[Test]
    public function so_source_takes_priority_over_item_and_asset_on_the_same_row(): void {
        $row          = $this->soRow($this->regularSoItem, 'r1');
        $row['item']  = ['id' => $this->freeVariant->id];
        $row['asset'] = ['id' => $this->asset->id];
        $validator    = $this->validate(['items' => [$row]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function free_item_row_requires_source_warehouse_and_unit(): void {
        $row = $this->freeItemRow();
        unset($row['source_warehouse'], $row['unit']);

        $validator = $this->validate(['items' => [$row]]);

        $this->assertEqualsCanonicalizing(
            ['items.0.source_warehouse.id', 'items.0.unit.id'],
            array_keys($validator->errors()->toArray()),
        );
    }

    #[Test]
    public function asset_rows_reject_unit_and_source_warehouse(): void {
        $free = $this->freeAssetRow($this->asset, 'fa1', ['unit' => ['id' => $this->unitId], 'source_warehouse' => ['id' => $this->warehouseId]]);
        $so   = $this->soRow($this->assetSoItem, 'a1', ['unit' => ['id' => $this->unitId]]);

        $validator = $this->validate(['items' => [$so, $free]]);

        $this->assertEqualsCanonicalizing(
            ['items.0.unit.id', 'items.1.unit.id', 'items.1.source_warehouse.id'],
            array_keys($validator->errors()->toArray()),
        );
    }

    #[Test]
    public function so_asset_row_must_be_rentable_but_free_asset_row_need_not_be(): void {
        $validator = $this->validate(['items' => [
            $this->soRow($this->nonRentableSoItem, 'a1'),
            $this->freeAssetRow($this->nonRentableAsset),
        ]]);

        $this->assertSame(['items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function so_asset_row_must_match_the_source_asset(): void {
        $row = $this->soRow($this->assetSoItem, 'a1', ['asset' => ['id' => $this->nonRentableAsset->id]]);

        $validator = $this->validate(['items' => [$row]]);

        $this->assertSame(['items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function return_delivery_note_accepts_free_item_rows_but_rejects_free_asset_rows(): void {
        $validator = $this->validate([
            'return_against' => ['id' => null],
            'items'          => [$this->freeItemRow()],
        ]);
        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));

        $against = DB::table('delivery_notes')->value('id') ?? (string) Str::ulid();
        $request = DeliveryNoteRequest::create('/', 'POST', [
            'reference_to'   => ['model' => SalesOrder::class],
            'return_against' => ['id' => $against],
            'items'          => [$this->freeAssetRow($this->asset)],
        ]);
        $request->setContainer(app());
        $data      = $request->all();
        $validator = ValidatorFacade::make($data, $this->itemRules($request));
        $request->withValidator($validator);

        $this->assertSame(['items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }
}
