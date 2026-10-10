<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Database\Factories\Finances\TaxFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * SalesInvoiceRequest menerima asset_items dengan identitas Asset langsung,
 * memvalidasi keanggotaan, dan menuntut minimal satu baris gabungan.
 */
class SalesInvoiceRequestAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private Item $regularItem;
    private Item $assetItem;
    private Asset $asset;
    private SalesOrderItem $regularSoItem;
    private SalesOrderItem $assetSoItem;
    private string $taxId;

    protected function setUp(): void {
        parent::setUp();

        $this->regularItem = Item::factory()->create(['is_fixed_asset' => false]);
        $this->assetItem   = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $this->asset       = $this->makeAsset($this->assetItem);
        $this->taxId       = TaxFactory::new()->create()->id;

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

    /**
     * @return array<string,mixed>
     */
    private function itemRules(SalesInvoiceRequest $request): array {
        return collect($request->rules())
            ->filter(fn ($rule, $key) => preg_match('/^(asset_)?items/', $key) === 1
                && preg_match('/^items\.\*\.unit(?:\.|$)/', $key) !== 1
                && preg_match('/\.(price|description|return_against_item_id)/', $key) !== 1)
            ->all();
    }

    private function validate(array $data): Validator {
        $request = SalesInvoiceRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $validator = ValidatorFacade::make($data, $this->itemRules($request));
        $request->withValidator($validator);

        return $validator;
    }

    private function row(SalesOrderItem $soItem, string $id, array $extra = []): array {
        return [
            'id'               => $id,
            'sales_order_item' => ['id' => $soItem->id],
            'quantity'         => 5,
            'tax'              => ['id' => $this->taxId],
            ...($soItem->asset_id ? ['asset' => ['id' => $soItem->asset_id]] : []),
            ...$extra,
        ];
    }

    private function makeAsset(Item $item, bool $rentable = true): Asset {
        $category = AssetCategory::factory()->create();

        return $rentable
            ? Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $item->id])
            : Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->id, 'is_rentable' => false]);
    }

    #[Test]
    public function rules_require_one_source_row_and_asset_id_only_in_asset_items(): void {
        $request = SalesInvoiceRequest::create('/', 'POST', []);
        $request->setContainer(app());
        $rules = $request->rules();

        $this->assertSame(['nullable', 'array'], $rules['items']);
        $this->assertArrayHasKey('asset_items.*.asset.id', $rules);
        $this->assertSame(['prohibited'], $rules['items.*.asset.id']);
        $this->assertSame(['prohibited'], $rules['asset_items.*.item.id']);
        $this->assertArrayHasKey('asset_items.*.sales_order_item.id', $rules);
        $this->assertArrayNotHasKey('asset_items.*.unit.id', $rules);
        $this->assertSame(['prohibited'], $rules['asset_items.*.unit']);
        $this->assertContains('required', $rules['asset_items.*.tax.id']);
    }

    #[Test]
    public function accepts_regular_rows_in_items_and_asset_rows_in_asset_items(): void {
        $validator = $this->validate([
            'items'       => [$this->row($this->regularSoItem, 'r1')],
            'asset_items' => [$this->row($this->assetSoItem, 'a1')],
        ]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_fixed_asset_row_in_items(): void {
        $validator = $this->validate(['items' => [$this->row($this->assetSoItem, 'x')]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_a_regular_row_in_asset_items(): void {
        $validator = $this->validate(['asset_items' => [$this->row($this->regularSoItem, 'x')]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('asset_items.0.asset.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_when_both_lists_are_empty_but_accepts_only_asset_items(): void {
        $empty = $this->validate(['items' => [], 'asset_items' => []]);
        $this->assertTrue($empty->fails());
        $this->assertArrayHasKey('items', $empty->errors()->toArray());

        $onlyAssets = $this->validate(['asset_items' => [$this->row($this->assetSoItem, 'a1')]]);
        $this->assertFalse($onlyAssets->fails(), json_encode($onlyAssets->errors()->toArray()));
    }

    #[Test]
    public function rejects_legacy_asset_lines_inside_items(): void {
        $asset = $this->makeAsset($this->assetItem);

        $validator = $this->validate(['items' => [
            $this->row($this->regularSoItem, 'r1', ['asset_lines' => [['asset' => ['id' => $asset->id], 'quantity' => 5]]]),
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset_lines', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_asset_identity_in_items_even_if_a_regular_source_row_is_selected(): void {
        $validator = $this->validate(['items' => [
            $this->row($this->regularSoItem, 'r1', ['asset' => ['id' => $this->asset->id]]),
        ]]);

        $this->assertSame(['items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_item_identity_in_asset_items_even_if_an_asset_source_row_is_selected(): void {
        $variant   = ItemVariant::factory()->create(['item_id' => $this->regularItem->id, 'is_stock_item' => true]);
        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1', ['item' => ['id' => $variant->id]]),
        ]]);

        $this->assertSame(['asset_items.0.item.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function accepts_asset_rows_with_the_source_asset_id(): void {
        $validator = $this->validate(['asset_items' => [$this->row($this->assetSoItem, 'a1')]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function requires_tax_for_asset_rows_without_requiring_a_unit(): void {
        $row = $this->row($this->assetSoItem, 'a1');
        unset($row['tax']);

        $validator = $this->validate(['asset_items' => [$row]]);

        $this->assertSame(['asset_items.0.tax.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_unit_on_asset_rows(): void {
        $row = $this->row($this->assetSoItem, 'a1', ['unit' => ['id' => 'unit-1']]);

        $validator = $this->validate(['asset_items' => [$row]]);

        $this->assertSame(['asset_items.0.unit'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_an_asset_id_that_does_not_match_the_selected_sales_order_item(): void {
        $otherAsset = $this->makeAsset($this->assetItem);

        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1', ['asset' => ['id' => $otherAsset->id]]),
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['asset_items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_nonexistent_asset(): void {
        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1', ['asset' => ['id' => (string) Str::ulid()]]),
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('asset_items.0.asset.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_an_asset_that_belongs_to_a_different_item(): void {
        $otherItem = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $asset     = $this->makeAsset($otherItem);

        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1', ['asset' => ['id' => $asset->id]]),
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['asset_items.0.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function a_non_rentable_asset_is_allowed_on_a_sales_invoice(): void {
        $asset = $this->makeAsset($this->assetItem, rentable: false);
        $this->assetSoItem->update(['asset_id' => $asset->id]);

        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1'),
        ]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }
}
