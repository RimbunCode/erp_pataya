<?php

namespace Tests\Feature\Inventory;

use App\Models\CRM\QuotationItemTax;
use App\Models\Finances\PurchaseInvoiceItemTax;
use App\Models\Finances\SalesInvoiceItemTax;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Models\Purchase\PurchaseOrderItemTax;
use App\Models\Sales\SalesOrderItemTax;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Pajak default Item lewat controller (spek finance-multi-tax-per-item, Requirement 15.2-15.3 dan 15.9): `store` dan
 * `update` menyimpan `default_sales_taxes`/`default_purchase_taxes` berurut, `id` berbentuk aneh ditolak 422 (bukan
 * 500), dan `initPermissions()` (F-12, Requirement 13.2) tidak mengubah skema `items`/`item_default_taxes`.
 */
class ItemDefaultTaxesControllerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Unit::class, Category::class, Item::class]);
    }

    private function http(): static {
        return $this
            ->withSession([
                'permissions' => [
                    Item::class => [
                        0 => [
                            [
                                'model'        => Item::class,
                                'level'        => 0,
                                'only_creator' => false,
                                'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true],
                            ],
                        ],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    private function tax(string $name, float $rate): Tax {
        return Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => Tax::CATEGORY_UNCLASSIFIED]);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function payload(string $code, array $extra = []): array {
        $unit     = Unit::create(['code' => 'U-' . $code, 'name' => 'Unit ' . $code]);
        $category = Category::factory()->create(['type' => 'inventory']);

        return [
            'code'           => $code,
            'name'           => 'Item ' . $code,
            'category'       => ['id' => $category->id],
            'default_unit'   => ['id' => $unit->id],
            'uoms'           => [['id' => $unit->id, 'conversion_factor' => 1]],
            'is_fixed_asset' => false,
            'is_disabled'    => false,
            ...$extra,
        ];
    }

    /**
     * @return list<string>
     */
    private function defaultTaxIds(Item $item, string $relation): array {
        return $item->fresh()->{$relation}()->get()->pluck('id')->all();
    }

    public function test_store_saves_default_taxes_for_both_modules_in_choice_order(): void {
        $ppn = $this->tax('PPN', 12);
        $pph = $this->tax('PPh 23', 2);

        $this->http()->post('/items', $this->payload('ITM-TAX-1', [
            'default_sales_taxes'    => [['id' => $pph->getKey()], ['id' => $ppn->getKey()]],
            'default_purchase_taxes' => [['id' => $ppn->getKey()]],
        ]))->assertSessionHasNoErrors();

        $item = Item::query()->where('code', 'ITM-TAX-1')->firstOrFail();
        $this->assertSame([$pph->getKey(), $ppn->getKey()], $this->defaultTaxIds($item, 'salesDefaultTaxes'), 'Urutan pilihan = position.');
        $this->assertSame([$ppn->getKey()], $this->defaultTaxIds($item, 'purchaseDefaultTaxes'));
    }

    public function test_update_replaces_and_clears_default_taxes_and_leaves_an_absent_field_alone(): void {
        $ppn   = $this->tax('PPN', 12);
        $pph   = $this->tax('PPh 23', 2);
        $first = $this->payload('ITM-TAX-2', [
            'default_sales_taxes'    => [['id' => $ppn->getKey()]],
            'default_purchase_taxes' => [['id' => $ppn->getKey()]],
        ]);
        $this->http()->post('/items', $first)->assertSessionHasNoErrors();
        $item = Item::query()->where('code', 'ITM-TAX-2')->firstOrFail();

        // Ganti penjualan, kosongkan pembelian.
        $this->http()->put("/items/{$item->id}", [...$first, 'id' => $item->id, 'default_sales_taxes' => [['id' => $pph->getKey()], ['id' => $ppn->getKey()]], 'default_purchase_taxes' => []])
            ->assertSessionHasNoErrors();
        $this->assertSame([$pph->getKey(), $ppn->getKey()], $this->defaultTaxIds($item, 'salesDefaultTaxes'));
        $this->assertSame([], $this->defaultTaxIds($item, 'purchaseDefaultTaxes'));

        // Field tidak dikirim: default yang ada tidak diubah.
        $withoutFields = $first;
        unset($withoutFields['default_sales_taxes'], $withoutFields['default_purchase_taxes']);
        $this->http()->put("/items/{$item->id}", [...$withoutFields, 'id' => $item->id])->assertSessionHasNoErrors();
        $this->assertSame([$pph->getKey(), $ppn->getKey()], $this->defaultTaxIds($item, 'salesDefaultTaxes'));
    }

    public function test_a_malformed_tax_id_is_rejected_with_422_not_500(): void {
        $ppn = $this->tax('PPN', 12);

        foreach ([[['id' => ['x']]], [['id' => [$ppn->getKey()]]], [['id' => new \stdClass]]] as $index => $taxes) {
            $response = $this->http()->post('/items', $this->payload("ITM-BAD-{$index}", ['default_sales_taxes' => $taxes]));

            $response->assertStatus(302);
            $response->assertSessionHasErrors('default_sales_taxes.0.id');
        }

        $this->assertSame(0, Item::query()->where('code', 'like', 'ITM-BAD-%')->count());
    }

    public function test_show_exposes_default_taxes_for_the_form(): void {
        $ppn = $this->tax('PPN', 12);
        $this->http()->post('/items', $this->payload('ITM-TAX-3', ['default_sales_taxes' => [['id' => $ppn->getKey()]]]))->assertSessionHasNoErrors();
        $item = Item::query()->where('code', 'ITM-TAX-3')->firstOrFail();

        $loaded = $item->salesDefaultTaxes()->get()->toArray();
        $this->assertSame($ppn->getKey(), $loaded[0]['id'], 'Objek pajak default yang dikirim ke form memuat id (nama field sama dengan field request).');
        $this->assertSame(0, $loaded[0]['pivot']['position']);
    }

    // ---------------------------------------------------------------------------------------------------------
    // F-12 (Requirement 13.2, 15.9): initPermissions() tidak boleh mengubah skema
    // ---------------------------------------------------------------------------------------------------------

    /**
     * @return array<string, array<string, mixed>>
     */
    private function snapshot(string $table): array {
        $columns = [];
        foreach (Schema::getColumns($table) as $column) {
            $columns[$column['name']] = ['type' => $column['type'], 'nullable' => $column['nullable'], 'default' => $column['default']];
        }
        ksort($columns);

        return $columns;
    }

    public function test_init_permissions_does_not_change_the_item_or_default_tax_tables(): void {
        $items = $this->snapshot('items');
        $pivot = $this->snapshot('item_default_taxes');

        Item::initPermissions();

        $this->assertSame($items, $this->snapshot('items'), 'initPermissions() mengubah skema items.');
        $this->assertSame($pivot, $this->snapshot('item_default_taxes'));
        $this->assertArrayNotHasKey('default_sales_taxes', $items, 'Pajak default tidak disimpan sebagai kolom items.');
    }

    public function test_pivot_models_are_not_datatable_models_so_no_init_permissions_exists_for_them(): void {
        foreach ([
            SalesInvoiceItemTax::class,
            PurchaseInvoiceItemTax::class,
            SalesOrderItemTax::class,
            PurchaseOrderItemTax::class,
            QuotationItemTax::class,
        ] as $model) {
            $this->assertFalse(method_exists($model, 'initPermissions'), "{$model} tidak boleh punya initPermissions() (tabel pivot tidak menerima is_example/have_transactions).");
        }

        foreach (['sales_invoice_item_taxes', 'purchase_invoice_item_taxes', 'sales_order_item_taxes', 'purchase_order_item_taxes', 'quotation_item_taxes'] as $table) {
            $this->assertArrayNotHasKey('have_transactions', $this->snapshot($table), $table);
        }
    }
}
