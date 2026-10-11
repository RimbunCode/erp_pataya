<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Database\Factories\Finances\TaxFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec delivery-note-sales-invoice-off-source-items: SalesInvoiceRequest menerima satu
 * `items[]` dengan tiga sumber per baris -- baris SO, ItemVariant bebas, Asset bebas.
 */
class SalesInvoiceRequestAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private Item $regularItem;
    private Item $assetItem;
    private Asset $asset;
    private ItemVariant $freeVariant;
    private SalesOrderItem $regularSoItem;
    private SalesOrderItem $assetSoItem;
    private string $taxId;
    private string $unitId;

    protected function setUp(): void {
        parent::setUp();

        $this->regularItem = Item::factory()->create(['is_fixed_asset' => false]);
        $this->assetItem   = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $this->asset       = $this->makeAsset($this->assetItem);
        $this->freeVariant = ItemVariant::factory()->create(['item_id' => $this->regularItem->id, 'is_stock_item' => true]);
        $this->taxId       = TaxFactory::new()->create()->id;

        $unit         = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $this->unitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $this->unitId,
            'item_id'    => $this->regularItem->id,
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

        $this->regularSoItem = $this->makeSalesOrderItem($salesOrder, $this->regularItem, 5);
        $this->assetSoItem   = $this->makeSalesOrderItem($salesOrder, $this->assetItem, 5, $this->asset);
    }

    private function makeSalesOrderItem(SalesOrder $salesOrder, Item $item, float $quantity, ?Asset $asset = null): SalesOrderItem {
        $variant = $asset ? null : ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => $item->is_stock_item]);

        return SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $variant?->id,
            'asset_id'       => $asset?->id,
            'quantity'       => $quantity,
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
    private function itemRules(SalesInvoiceRequest $request): array {
        return collect($request->rules())
            ->filter(fn ($rule, $key) => str_starts_with($key, 'items'))
            ->all();
    }

    private function validate(array $data): Validator {
        $request = SalesInvoiceRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $validator = ValidatorFacade::make($data, $this->itemRules($request));
        $request->withValidator($validator);

        return $validator;
    }

    /** Baris dari SO: ItemVariant (dengan unit) atau Asset (tanpa unit). */
    private function soRow(SalesOrderItem $soItem, string $id, array $extra = []): array {
        return [
            'id'               => $id,
            'sales_order_item' => ['id' => $soItem->id],
            'quantity'         => 5,
            'tax'              => ['id' => $this->taxId],
            ...($soItem->asset_id
                ? ['asset' => ['id' => $soItem->asset_id]]
                : ['unit' => ['id' => $this->unitId]]),
            ...$extra,
        ];
    }

    private function freeItemRow(string $id = 'f1', array $extra = []): array {
        return [
            'id'       => $id,
            'item'     => ['id' => $this->freeVariant->id],
            'quantity' => 2,
            'unit'     => ['id' => $this->unitId],
            'tax'      => ['id' => $this->taxId],
            'price'    => 1500,
            ...$extra,
        ];
    }

    private function freeAssetRow(Asset $asset, string $id = 'fa1', array $extra = []): array {
        return [
            'id'       => $id,
            'asset'    => ['id' => $asset->id],
            'quantity' => 1,
            'tax'      => ['id' => $this->taxId],
            'price'    => 9000,
            ...$extra,
        ];
    }

    #[Test]
    public function rules_use_a_single_required_items_list_with_three_optional_sources(): void {
        $request = SalesInvoiceRequest::create('/', 'POST', []);
        $request->setContainer(app());
        $rules = $request->rules();

        $this->assertSame(['required', 'array', 'min:1'], $rules['items']);
        $this->assertArrayNotHasKey('asset_items', $rules);
        $this->assertArrayNotHasKey('asset_items.*.asset.id', $rules);
        $this->assertContains('required_without_all:items.*.item.id,items.*.asset.id', $rules['items.*.sales_order_item.id']);
        $this->assertContains('required', $rules['items.*.tax.id']);
        $this->assertContains('required_without:items.*.sales_order_item.id', $rules['items.*.price']);
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
    public function rejects_when_the_list_is_empty_and_accepts_a_document_with_only_asset_rows(): void {
        $empty = $this->validate(['items' => []]);
        $this->assertTrue($empty->fails());
        $this->assertArrayHasKey('items', $empty->errors()->toArray());

        $onlyAssets = $this->validate(['items' => [$this->soRow($this->assetSoItem, 'a1')]]);
        $this->assertFalse($onlyAssets->fails(), json_encode($onlyAssets->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_row_without_any_source(): void {
        $validator = $this->validate(['items' => [['id' => 'x', 'quantity' => 1, 'tax' => ['id' => $this->taxId], 'price' => 10]]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.sales_order_item.id', $validator->errors()->toArray());
    }

    #[Test]
    public function so_source_takes_priority_over_item_and_asset_on_the_same_row(): void {
        $row          = $this->soRow($this->regularSoItem, 'r1');
        $row['item']  = ['id' => $this->freeVariant->id];
        $row['asset'] = ['id' => $this->asset->id];

        $validator = $this->validate(['items' => [$row]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function free_rows_require_a_price_but_so_rows_do_not(): void {
        $item = $this->freeItemRow();
        unset($item['price']);
        $asset = $this->freeAssetRow($this->asset);
        unset($asset['price']);

        $validator = $this->validate(['items' => [$this->soRow($this->regularSoItem, 'r1'), $item, $asset]]);

        $this->assertEqualsCanonicalizing(['items.1.price', 'items.2.price'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function requires_tax_for_every_row_and_a_unit_only_for_item_rows(): void {
        $asset = $this->freeAssetRow($this->asset);
        unset($asset['tax']);
        $itemNoUnit = $this->freeItemRow('f2');
        unset($itemNoUnit['unit']);

        $taxError = $this->validate(['items' => [$asset]]);
        $this->assertSame(['items.0.tax.id'], array_keys($taxError->errors()->toArray()));

        $unitError = $this->validate(['items' => [$itemNoUnit]]);
        $this->assertSame(['items.0.unit.id'], array_keys($unitError->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_unit_on_asset_rows(): void {
        $so   = $this->soRow($this->assetSoItem, 'a1', ['unit' => ['id' => $this->unitId]]);
        $free = $this->freeAssetRow($this->asset, 'fa1', ['unit' => ['id' => $this->unitId]]);

        $validator = $this->validate(['items' => [$so, $free]]);

        $this->assertEqualsCanonicalizing(['items.0.unit.id', 'items.1.unit.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_an_asset_id_that_does_not_match_the_selected_sales_order_item(): void {
        $otherAsset = $this->makeAsset($this->assetItem);

        $validator = $this->validate(['items' => [
            $this->soRow($this->assetSoItem, 'a1', ['asset' => ['id' => $otherAsset->id]]),
        ]]);

        $this->assertSame(['items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_nonexistent_free_asset(): void {
        $validator = $this->validate(['items' => [
            ['id' => 'fa', 'asset' => ['id' => (string) Str::ulid()], 'quantity' => 1, 'tax' => ['id' => $this->taxId], 'price' => 1],
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset.id', $validator->errors()->toArray());
    }

    #[Test]
    public function a_non_rentable_asset_is_allowed_on_a_sales_invoice(): void {
        $asset = $this->makeAsset($this->assetItem, rentable: false);

        $validator = $this->validate(['items' => [$this->freeAssetRow($asset)]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function return_invoice_accepts_free_item_rows_but_rejects_free_asset_rows(): void {
        $data = fn (array $row) => [
            'return_against' => ['id' => (string) Str::ulid()],
            'items'          => [$row],
        ];

        $item = $this->validate($data($this->freeItemRow()));
        $this->assertFalse($item->fails(), json_encode($item->errors()->toArray()));

        $asset = $this->validate($data($this->freeAssetRow($this->asset)));
        $this->assertSame(['items.0.asset.id'], array_keys($asset->errors()->toArray()));
    }
}
