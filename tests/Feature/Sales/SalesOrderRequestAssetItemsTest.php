<?php

namespace Tests\Feature\Sales;

use App\Http\Requests\Sales\SalesOrderRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetService;
use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Sales\SalesSetting;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec sales-order-asset-in-items-column: SalesOrderRequest menerima satu `items[]`
 * dengan tiap baris berisi `item.id` (ItemVariant) XOR `asset.id` (Asset).
 */
class SalesOrderRequestAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private ItemVariant $regularVariant;
    private Asset $asset;
    private string $warehouseId;
    private string $taxId;
    private string $unitId;

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

        $unit         = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $this->unitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $this->unitId,
            'item_id'    => $regular->id,
            'unit_id'    => $unit->id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Rule asli request, difilter ke key yang menyangkut baris (tanpa data FK lain).
     *
     * @return array<string,mixed>
     */
    private function itemRules(SalesOrderRequest $request): array {
        $pattern = '/^items(\.\*)?(\.(id|quantity|item\.id|item\.\*|asset\.id|asset\.\*|unit\.id|tax\.id|tax\.\*|source_warehouse\.id|referenceable\.type|referenceable\.id))?$/';

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
            'unit'             => ['id' => $this->unitId],
            'tax'              => ['id' => $this->taxId],
            'source_warehouse' => ['id' => $this->warehouseId],
        ];
    }

    private function assetRow(string $id = 'a1'): array {
        return ['id' => $id, 'asset' => ['id' => $this->asset->id], 'quantity' => 1, 'tax' => ['id' => $this->taxId]];
    }

    #[Test]
    public function rules_use_a_single_required_items_list_and_no_asset_items_key(): void {
        $request = SalesOrderRequest::create('/', 'POST', []);
        $request->setContainer(app());
        $rules = $request->rules();

        $this->assertSame(['required', 'array', 'min:1'], $rules['items']);
        $this->assertArrayNotHasKey('asset_items', $rules);
        $this->assertContains('required_without:items.*.asset.id', $rules['items.*.item.id']);
        $this->assertContains('required_without:items.*.item.id', $rules['items.*.asset.id']);
        $this->assertContains('nullable', $rules['items.*.tax.id']);
    }

    #[Test]
    public function accepts_regular_and_asset_rows_in_the_same_items_list(): void {
        $validator = $this->validate(['items' => [$this->regularRow(), $this->assetRow()]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function accepts_a_document_that_only_has_asset_rows(): void {
        $validator = $this->validate(['items' => [$this->assetRow()]]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function rows_without_tax_are_rejected_when_no_explicit_no_tax_rule_matches(): void {
        $regular = $this->regularRow();
        unset($regular['tax']);
        $asset = $this->assetRow();
        unset($asset['tax']);

        $validator = $this->validate(['items' => [$regular, $asset]]);

        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('items.0.tax.id', $errors);
        $this->assertArrayHasKey('items.1.tax.id', $errors);
    }

    #[Test]
    public function a_default_module_tax_alone_does_not_make_tax_optional(): void {
        SalesSetting::current()->fill(['default_tax_id' => $this->taxId])->save();
        $regular = $this->regularRow();
        unset($regular['tax']);

        $this->assertArrayHasKey('items.0.tax.id', $this->validate(['items' => [$regular]])->errors()->toArray());
    }

    #[Test]
    public function accepts_rows_without_tax_when_an_explicit_no_tax_rule_matches_the_row_item(): void {
        // Aturan tanpa pajak khusus barang reguler (item_type + is_stock_item), bukan untuk asset.
        $regularItem = $this->regularVariant->item;
        DefaultTaxRule::query()->create([
            'module'        => 'sales', 'document_type' => 'sales_order', 'item_type' => $regularItem->type,
            'is_stock_item' => (bool) $regularItem->is_stock_item, 'tax_id' => null, 'priority' => 0,
        ]);
        $regular = $this->regularRow();
        unset($regular['tax']);
        $asset = $this->assetRow();
        unset($asset['tax']);

        $regularOnly = $this->validate(['items' => [$regular]]);
        $this->assertFalse($regularOnly->fails(), json_encode($regularOnly->errors()->toArray()));

        // Baris asset (barang lain, tidak cocok aturan) tetap wajib berpajak.
        $this->assertTrue($regularItem->type !== $this->asset->item->type || $regularItem->is_stock_item !== $this->asset->item->is_stock_item);
        $mixed = $this->validate(['items' => [$regular, $asset]]);
        $this->assertArrayNotHasKey('items.0.tax.id', $mixed->errors()->toArray());
        $this->assertArrayHasKey('items.1.tax.id', $mixed->errors()->toArray());
    }

    #[Test]
    public function no_tax_rule_for_another_document_type_does_not_apply(): void {
        $regularItem = $this->regularVariant->item;
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_invoice', 'item_type' => $regularItem->type, 'tax_id' => null, 'priority' => 0]);
        $regular = $this->regularRow();
        unset($regular['tax']);

        $this->assertArrayHasKey('items.0.tax.id', $this->validate(['items' => [$regular]])->errors()->toArray());
    }

    #[Test]
    public function deleted_tax_in_a_rule_is_a_broken_reference_not_a_no_tax_rule(): void {
        $deletedTax  = TaxFactory::new()->create();
        $regularItem = $this->regularVariant->item;
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_order', 'item_type' => $regularItem->type, 'tax_id' => $deletedTax->id, 'priority' => 0]);
        $deletedTax->delete();
        $regular = $this->regularRow();
        unset($regular['tax']);

        $this->assertArrayHasKey('items.0.tax.id', $this->validate(['items' => [$regular]])->errors()->toArray());
    }

    #[Test]
    public function requires_a_unit_for_regular_rows(): void {
        $row = $this->regularRow();
        unset($row['unit']);

        $validator = $this->validate(['items' => [$row]]);

        $this->assertSame(['items.0.unit.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_unit_or_warehouse_on_asset_rows(): void {
        $row                     = $this->assetRow();
        $row['unit']             = ['id' => $this->unitId];
        $row['source_warehouse'] = ['id' => $this->warehouseId];

        $validator = $this->validate(['items' => [$row]]);

        $this->assertEqualsCanonicalizing(
            ['items.0.unit.id', 'items.0.source_warehouse.id'],
            array_keys($validator->errors()->toArray()),
        );
    }

    #[Test]
    public function rejects_a_row_with_both_item_and_asset(): void {
        $row          = $this->regularRow();
        $row['asset'] = ['id' => $this->asset->id];

        $validator = $this->validate(['items' => [$row]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['items.0.asset'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_a_row_with_neither_item_nor_asset(): void {
        $validator = $this->validate(['items' => [['id' => 'x', 'quantity' => 1, 'tax' => ['id' => $this->taxId]]]]);

        $this->assertTrue($validator->fails());
        $this->assertEqualsCanonicalizing(
            ['items.0.item.id', 'items.0.asset.id', 'items.0.unit.id'],
            array_keys($validator->errors()->toArray()),
        );
    }

    #[Test]
    public function rejects_when_the_list_is_empty_or_missing(): void {
        foreach ([['items' => []], []] as $data) {
            $validator = $this->validate($data);

            $this->assertTrue($validator->fails());
            $this->assertArrayHasKey('items', $validator->errors()->toArray());
        }
    }

    #[Test]
    public function source_warehouse_is_required_for_stock_item_rows_but_not_asset_rows(): void {
        $noWarehouseRegular = $this->regularRow();
        unset($noWarehouseRegular['source_warehouse']);

        $validator = $this->validate(['items' => [$noWarehouseRegular, $this->assetRow()]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['items.0.source_warehouse.id'], array_keys($validator->errors()->toArray()));
    }

    #[Test]
    public function asset_service_referenceable_check_runs_on_asset_rows(): void {
        $row                  = $this->assetRow();
        $row['referenceable'] = ['type' => AssetService::class, 'id' => (string) Str::ulid()];

        $validator = $this->validate(['items' => [$row]]);

        $this->assertTrue($validator->fails());
        $this->assertSame(['items.0.referenceable.id'], array_keys($validator->errors()->toArray()));
    }
}
