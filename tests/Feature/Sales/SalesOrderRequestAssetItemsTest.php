<?php

namespace Tests\Feature\Sales;

use App\Http\Requests\Sales\SalesOrderRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetService;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Requirement 6.1-6.5, 8.1, 9.1, spec asset-items-section: SalesOrderRequest menerima
 * `asset_items` dengan rule yang dicerminkan dari `items`, memvalidasi keanggotaan tiap
 * baris, dan menuntut minimal 1 baris untuk gabungan keduanya.
 */
class SalesOrderRequestAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private ItemVariant $regularVariant;
    private Asset $asset;
    private string $warehouseId;
    private string $taxId;

    protected function setUp(): void {
        parent::setUp();

        $regular   = Item::factory()->create(['is_fixed_asset' => false]);
        $assetItem = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);

        // is_stock_item WAJIB eksplisit: ItemVariantFactory menghitungnya dari Item ACAK
        // (bukan dari item_id yang dioverride), sehingga tanpa ini tes menjadi flaky.
        $this->regularVariant = ItemVariant::factory()->create(['item_id' => $regular->id, 'is_stock_item' => true]);
        $this->asset          = Asset::factory()->create([
            'asset_category_id' => AssetCategory::factory(),
            'item_id'           => $assetItem->id,
        ]);
        $this->warehouseId = WarehouseFactory::new()->create()->id;
        $this->taxId       = TaxFactory::new()->create()->id;
    }

    /**
     * Rule asli request, difilter ke key yang menyangkut baris (tanpa data FK lain).
     *
     * @return array<string,mixed>
     */
    private function itemRules(SalesOrderRequest $request): array {
        $pattern = '/^(asset_)?items(\.\*)?(\.(id|quantity|item\.id|item\.\*|asset\.id|asset\.\*|tax\.id|tax\.\*|source_warehouse\.id|referenceable\.type|referenceable\.id|unit))?$/';

        return collect($request->rules())
            ->filter(fn ($rule, $key) => preg_match($pattern, $key) === 1)
            ->all();
    }

    private function validate(array $data): Validator {
        $request = SalesOrderRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $validator = ValidatorFacade::make($data, $this->itemRules($request));
        $request->withValidator($validator);

        return $validator;
    }

    private function regularRow(string $id = 'r1'): array {
        return [
            'id'               => $id,
            'item'             => ['id' => $this->regularVariant->id],
            'quantity'         => 1,
            'tax'              => ['id' => $this->taxId],
            'source_warehouse' => ['id' => $this->warehouseId],
        ];
    }

    private function assetRow(string $id = 'a1'): array {
        return ['id' => $id, 'asset' => ['id' => $this->asset->id], 'quantity' => 1, 'tax' => ['id' => $this->taxId]];
    }

    #[Test]
    public function rules_mirror_the_item_rules_to_asset_items_and_make_the_list_rules_optional(): void {
        $request = SalesOrderRequest::create('/', 'POST', []);
        $request->setContainer(app());
        $rules = $request->rules();

        $this->assertSame(['nullable', 'array'], $rules['items']);
        $this->assertSame(['nullable', 'array'], $rules['asset_items']);
        foreach (['id', 'item.id', 'quantity', 'tax.id', 'price', 'source_warehouse.id'] as $field) {
            $this->assertArrayHasKey("asset_items.*.{$field}", $rules, "rule asset_items.*.{$field} harus ada");
        }
        $this->assertArrayNotHasKey('asset_items.*.unit.id', $rules);
        $this->assertSame(['prohibited'], $rules['asset_items.*.unit']);
        $this->assertContains('required', $rules['asset_items.*.tax.id']);
        $this->assertArrayHasKey('asset_items.*.asset.id', $rules);
        $this->assertSame(['prohibited'], $rules['asset_items.*.item.id']);
        $this->assertSame(['prohibited'], $rules['items.*.asset.id']);
        $this->assertSame(
            ['nullable', 'string', 'required_with:asset_items.*.referenceable.type'],
            $rules['asset_items.*.referenceable.id'],
        );
    }

    #[Test]
    public function accepts_regular_rows_in_items_and_asset_rows_in_asset_items(): void {
        $validator = $this->validate([
            'items'       => [$this->regularRow()],
            'asset_items' => [$this->assetRow()],
        ]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function document_without_asset_items_behaves_as_before(): void {
        $validator = $this->validate(['items' => [$this->regularRow('r1'), $this->regularRow('r2')]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function accepts_a_document_that_only_has_asset_items(): void {
        $validator = $this->validate(['asset_items' => [$this->assetRow()]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function requires_tax_for_asset_rows_without_requiring_a_unit(): void {
        $row = $this->assetRow();
        unset($row['tax']);

        $validator = $this->validate(['asset_items' => [$row]]);

        $this->assertSame(['asset_items.0.tax.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_unit_on_asset_rows(): void {
        $row         = $this->assetRow();
        $row['unit'] = ['id' => 'unit-1'];

        $validator = $this->validate(['asset_items' => [$row]]);

        $this->assertSame(['asset_items.0.unit'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_fixed_asset_row_in_items(): void {
        $validator = $this->validate(['items' => [$this->regularRow(), [
            'id'       => 'x',
            'item'     => ['id' => $this->regularVariant->id],
            'asset'    => ['id' => $this->asset->id],
            'quantity' => 1,
            'tax'      => ['id' => $this->taxId],
        ]]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['items.1.asset.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_regular_row_in_asset_items(): void {
        $validator = $this->validate(['asset_items' => [[
            'id'       => 'r1',
            'item'     => ['id' => $this->regularVariant->id],
            'asset'    => ['id' => $this->asset->id],
            'quantity' => 1,
            'tax'      => ['id' => $this->taxId],
        ]]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['asset_items.0.item.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_when_both_lists_are_empty(): void {
        foreach ([['items' => [], 'asset_items' => []], []] as $data) {
            $validator = $this->validate($data);

            $this->assertTrue($validator->fails());
            $this->assertArrayHasKey('items', $validator->errors()->toArray());
        }
    }

    #[Test]
    public function rejects_legacy_asset_lines_inside_items(): void {
        $row                = $this->regularRow();
        $row['asset_lines'] = [['asset' => ['id' => (string) Str::ulid()], 'quantity' => 1]];

        $validator = $this->validate(['items' => [$row]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset_lines', $validator->errors()->toArray());
    }

    #[Test]
    public function source_warehouse_is_not_required_for_asset_rows_but_is_checked_in_both_buckets(): void {
        $noWarehouseRegular = $this->regularRow();
        unset($noWarehouseRegular['source_warehouse']);

        $validator = $this->validate([
            'items'       => [$noWarehouseRegular],
            'asset_items' => [$this->assetRow()],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['items.0.source_warehouse.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function asset_service_referenceable_check_runs_on_the_asset_items_bucket(): void {
        $row                  = $this->assetRow();
        $row['referenceable'] = ['type' => AssetService::class, 'id' => (string) Str::ulid()];

        $validator = $this->validate(['asset_items' => [$row]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['asset_items.0.referenceable.id'], array_keys($validator->errors()->toArray()));
    }
}
