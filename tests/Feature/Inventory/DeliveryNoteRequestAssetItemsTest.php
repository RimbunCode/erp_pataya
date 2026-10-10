<?php

namespace Tests\Feature\Inventory;

use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * DeliveryNoteRequest menerima Asset Items dengan asset_id langsung, menolak
 * payload legacy pada Items, dan mempertahankan perilaku list minimum lama.
 */
class DeliveryNoteRequestAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private Item $regularItem;
    private Item $assetItem;
    private Asset $asset;
    private SalesOrderItem $regularSoItem;
    private SalesOrderItem $assetSoItem;

    protected function setUp(): void {
        parent::setUp();

        $this->regularItem = Item::factory()->create(['is_fixed_asset' => false]);
        $this->assetItem   = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $this->asset       = $this->makeAsset($this->assetItem);

        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        $this->regularSoItem = $this->makeSalesOrderItem($salesOrder, $this->regularItem);
        $this->assetSoItem   = $this->makeSalesOrderItem($salesOrder, $this->assetItem, $this->asset);
    }

    private function makeSalesOrderItem(SalesOrder $salesOrder, Item $item, ?Asset $asset = null): SalesOrderItem {
        $variant = $asset ? null : ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => $item->is_stock_item]);

        return SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $variant?->id,
            'asset_id'       => $asset?->id,
            'quantity'       => 5,
            'price'          => 0,
        ]);
    }

    /**
     * @return array<string,mixed>
     */
    private function itemRules(DeliveryNoteRequest $request): array {
        return collect($request->rules())
            ->filter(fn ($rule, $key) => preg_match('/^(asset_)?items/', $key) === 1
                && preg_match('/^items\.\*\.unit(?:\.|$)/', $key) !== 1
                && preg_match('/\.(source_warehouse|description|return_against_item)/', $key) !== 1)
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

    private function row(SalesOrderItem $soItem, string $id, array $extra = []): array {
        return [
            'id'                 => $id,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
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
    public function missing_reference_to_is_a_validation_error_instead_of_a_rules_exception(): void {
        $request = DeliveryNoteRequest::create('/', 'POST');
        $request->setContainer(app());

        $validator = ValidatorFacade::make([], $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('reference_to.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rules_require_asset_for_asset_rows_and_prohibit_mixed_identity_fields(): void {
        $request = DeliveryNoteRequest::create('/', 'POST', ['reference_to' => ['model' => SalesOrder::class]]);
        $request->setContainer(app());
        $rules = $request->rules();

        $this->assertArrayHasKey('items.*.asset.id', $rules);
        $this->assertSame(['prohibited'], $rules['items.*.asset.id']);
        $this->assertArrayHasKey('asset_items.*.asset.id', $rules);
        $this->assertSame(['prohibited'], $rules['asset_items.*.item.id']);
        $this->assertArrayHasKey('asset_items.*.source_warehouse.id', $rules);
        $this->assertArrayNotHasKey('asset_items.*.unit.id', $rules);
        $this->assertSame(['prohibited'], $rules['asset_items.*.unit']);
        $this->assertArrayNotHasKey('items', $rules, 'DN tidak punya rule list-level untuk items');
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
    public function empty_lists_are_not_rejected_because_dn_has_no_minimum_rule(): void {
        $this->assertFalse($this->validate(['items' => [], 'asset_items' => []])->fails());
        $this->assertFalse($this->validate([])->fails());
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
    public function accepts_asset_rows_that_match_the_selected_sales_order_item(): void {
        $validator = $this->validate(['asset_items' => [$this->row($this->assetSoItem, 'a1')]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_unit_on_asset_rows(): void {
        $row = $this->row($this->assetSoItem, 'a1', ['unit' => ['id' => 'unit-1']]);

        $validator = $this->validate(['asset_items' => [$row]]);

        $this->assertSame(['asset_items.0.unit'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_an_asset_that_is_not_rentable(): void {
        $asset      = $this->makeAsset($this->assetItem, rentable: false);
        $sourceItem = $this->makeSalesOrderItem($this->assetSoItem->salesOrder, $this->assetItem, $asset);

        $validator = $this->validate(['asset_items' => [$this->row($sourceItem, 'a1')]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('asset_items.0.asset.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_an_asset_that_does_not_match_the_source_sales_order_item(): void {
        $other = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $asset = $this->makeAsset($other);

        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1', ['asset' => ['id' => $asset->id]]),
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('asset_items.0.asset.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_a_nonexistent_asset(): void {
        $validator = $this->validate(['asset_items' => [
            $this->row($this->assetSoItem, 'a1', ['asset' => ['id' => (string) Str::ulid()]]),
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('asset_items.0.asset.id', $validator->errors()->toArray());
    }
}
