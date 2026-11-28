<?php

namespace Tests\Feature\Finances\Tax;

use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\Sales\SalesOrderItemTax;
use App\Models\User\User;
use App\Services\Finances\InvoiceBilledValueResolver;
use App\Services\Finances\Tax\TaxRuleVersionService;
use App\Services\Purchase\PurchaseOrderService;
use App\Services\Sales\SalesOrderService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Pajak majemuk per item pada Sales Order dan Purchase Order (spek finance-multi-tax-per-item, Task 9; Requirement
 * 14.1-14.7, 14.10, keputusan Q-MT-12 Opsi A): pivot, perhitungan lewat `TaxEngine` (total order = total invoice),
 * pajak potong terpisah, gagal tertutup, sinkronisasi baris dari invoice, backfill berparitas, dan kontrak props/request.
 */
class MultiTaxOrderTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, SalesOrder::class, Supplier::class, PurchaseOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert(['key' => 'timezone', 'value' => json_encode('UTC'), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()]);

        // Supplier memakai nested set (lft/rgt/depth) yang tidak ada di migrasi; pola sama dengan PurchaseOrderDiscountPersistenceTest.
        if (! Schema::hasColumn('suppliers', 'lft')) {
            Schema::table('suppliers', function ($t) {
                $t->unsignedInteger('lft')->default(0);
                $t->unsignedInteger('rgt')->default(0);
                $t->unsignedInteger('depth')->default(0);
            });
        }

        Auth::login(User::factory()->create());
    }

    private function tax(string $name, float $rate, string $category, string $behavior = Tax::BEHAVIOR_ADDITIVE): Tax {
        $tax = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => $category, 'behavior' => $behavior]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        return $tax->fresh();
    }

    private function ppn(): Tax {
        return $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
    }

    private function luxury(): Tax {
        return $this->tax('PPnBM 10', 10, Tax::CATEGORY_PPN_LUXURY);
    }

    private function pph(): Tax {
        return $this->tax('PPh 23', 2, Tax::CATEGORY_UNCLASSIFIED, Tax::BEHAVIOR_WITHHOLDING);
    }

    /**
     * @return array{item_id: string, unit_id: string}
     */
    private function itemWithUnit(): array {
        $unit        = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $item        = Item::factory()->create(['default_unit_id' => $unit->id]);
        $itemVariant = ItemVariantFactory::new()->for($item, 'item')->create();
        $itemUnitId  = (string) Str::ulid();
        DB::table('item_units')->insert(['id' => $itemUnitId, 'item_id' => $itemVariant->item_id, 'unit_id' => $itemVariant->default_unit_id, 'is_default' => true, 'order' => 0, 'created_at' => now(), 'updated_at' => now()]);

        return ['item_id' => $itemVariant->id, 'unit_id' => $itemUnitId];
    }

    /**
     * @param  list<Tax>  $taxes
     * @return array<string, mixed>
     */
    private function salesPayload(array $taxes, float $price = 100_000): array {
        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();
        $line     = $this->itemWithUnit();

        return [
            'customer'          => ['id' => $customer->id],
            'customer_branch'   => ['id' => $branch->id],
            'branch'            => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'              => now()->toDateString(),
            'payment_schedules' => [],
            'items'             => [[
                'id'               => (string) Str::ulid(),
                'item'             => ['id' => $line['item_id']],
                'unit'             => ['id' => $line['unit_id']],
                'source_warehouse' => ['id' => WarehouseFactory::new()->create()->id],
                'taxes'            => array_map(fn (Tax $tax): array => ['id' => $tax->getKey()], $taxes),
                'quantity'         => 10,
                'price'            => $price,
            ]],
        ];
    }

    /**
     * @param  list<Tax>  $taxes
     * @return array<string, mixed>
     */
    private function purchasePayload(array $taxes): array {
        $country  = CountryFactory::new()->create();
        $supplier = Supplier::query()->create(['name' => 'PT Test Supplier', 'is_disabled' => false, 'country_id' => $country->code]);
        $line     = $this->itemWithUnit();

        return [
            'supplier'      => ['id' => $supplier->id],
            'branch'        => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'          => now()->toDateString(),
            'required_date' => now()->addDay()->toDateString(),
            'items'         => [[
                'id'               => (string) Str::ulid(),
                'item'             => ['id' => $line['item_id']],
                'unit'             => ['id' => $line['unit_id']],
                'target_warehouse' => ['id' => WarehouseFactory::new()->create()->id],
                'taxes'            => array_map(fn (Tax $tax): array => ['id' => $tax->getKey()], $taxes),
                'quantity'         => 10,
                'rate'             => 100_000,
                'required_date'    => now()->addDay()->toDateString(),
            ]],
        ];
    }

    private function createSalesOrder(array $taxes, float $price = 100_000): SalesOrder {
        return app(SalesOrderService::class)->create($this->salesPayload($taxes, $price))->fresh(['items.taxLines']);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Sales Order
    // ---------------------------------------------------------------------------------------------------------

    public function test_a_single_tax_sales_order_item_gets_a_pivot_row_and_engine_amounts(): void {
        $ppn  = $this->ppn();
        $item = $this->createSalesOrder([$ppn])->items->first();

        // Q-MT-12 Opsi A: 1.000.000 x 11/12 x 12% = 110.000 (bukan 120.000 seperti hitung sederhana lama).
        $this->assertEqualsWithDelta(110_000, $item->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1_110_000, $item->amount, 0.01);
        $this->assertSame($ppn->getKey(), $item->tax_id, 'Kolom item mencerminkan Pajak Utama.');
        $this->assertEqualsWithDelta(12.0, $item->tax_rate, 0.0001);
        $this->assertCount(1, $item->taxLines);
        $line = $item->taxLines->first();
        $this->assertSame(0, $line->position);
        $this->assertNotNull($line->tax_rule_version_id);
        $this->assertEqualsWithDelta(110_000, $line->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1_000_000, $line->base_amount, 0.01);
    }

    public function test_two_additive_taxes_sum_into_the_item_and_the_document_total(): void {
        $ppn       = $this->ppn();
        $luxury    = $this->luxury();
        $order     = $this->createSalesOrder([$ppn, $luxury]);
        $item      = $order->items->first();
        $expectTax = 110_000 + 1_000_000 * 11 / 12 * 0.10;

        $this->assertCount(2, $item->taxLines);
        $this->assertSame([$ppn->getKey(), $luxury->getKey()], $item->taxLines->pluck('tax_id')->all(), 'Urutan pilihan = position.');
        $this->assertSame($ppn->getKey(), $item->tax_id);
        $this->assertEqualsWithDelta($expectTax, $item->tax_amount, 0.02, 'tax_amount item = Σ pajak penambah.');
        $this->assertEqualsWithDelta($expectTax, $item->taxLines->sum('tax_amount'), 0.02, 'Agregat item = Σ pivot.');
        $this->assertEqualsWithDelta(1_000_000 + $expectTax, (float) $order->amount, 0.02);
    }

    public function test_a_withholding_tax_is_recorded_separately_and_does_not_change_the_total(): void {
        $ppn   = $this->ppn();
        $pph   = $this->pph();
        $order = $this->createSalesOrder([$ppn, $pph]);
        $item  = $order->items->first();

        $withheld = $item->taxLines->firstWhere('tax_id', $pph->getKey());
        $this->assertGreaterThan(0.0, $withheld->withholding_amount, 'Pajak potong tercatat di pivot.');
        $this->assertEqualsWithDelta(0.0, $withheld->tax_amount, 0.0001);
        $this->assertEqualsWithDelta(110_000, $item->tax_amount, 0.01, 'tax_amount item hanya pajak penambah.');
        $this->assertEqualsWithDelta(1_110_000, (float) $order->amount, 0.01, 'Pajak potong tidak menambah atau mengurangi total order.');
    }

    public function test_the_order_total_equals_the_invoice_total_for_the_same_taxes(): void {
        $ppn      = $this->ppn();
        $luxury   = $this->luxury();
        $order    = $this->createSalesOrder([$ppn, $luxury]);
        $expected = 1_000_000 + 1_000_000 * 11 / 12 * (0.12 + 0.10);

        $this->assertEqualsWithDelta($expected, (float) $order->amount, 0.02);
    }

    public function test_updating_a_sales_order_replaces_the_tax_set_and_prunes_removed_pivot_rows(): void {
        $ppn     = $this->ppn();
        $luxury  = $this->luxury();
        $order   = $this->createSalesOrder([$ppn, $luxury]);
        $payload = $this->salesPayload([$ppn]);

        $payload['items'][0]['id'] = $order->items->first()->id;
        app(SalesOrderService::class)->update($order, $payload);

        $item = SalesOrderItem::query()->with('taxLines')->findOrFail($order->items->first()->id);
        $this->assertSame([$ppn->getKey()], $item->taxLines->pluck('tax_id')->all());
        $this->assertEqualsWithDelta(110_000, $item->tax_amount, 0.01);
        $this->assertSame(1, SalesOrderItemTax::query()->where('sales_order_item_id', $item->id)->count());
    }

    public function test_an_order_item_without_taxes_has_no_pivot_and_zero_tax(): void {
        $item = $this->createSalesOrder([])->items->first();

        $this->assertNull($item->tax_id);
        $this->assertCount(0, $item->taxLines);
        $this->assertEqualsWithDelta(0.0, $item->tax_amount, 0.0001);
        $this->assertEqualsWithDelta(1_000_000, $item->amount, 0.01);
    }

    public function test_a_tax_without_an_effective_rule_version_fails_closed_without_writing_the_order(): void {
        $noRule = Tax::query()->create(['name' => 'Tanpa versi', 'rate' => 11, 'category' => Tax::CATEGORY_PPN_STANDARD]);
        $before = SalesOrder::query()->count();

        try {
            app(SalesOrderService::class)->create($this->salesPayload([$noRule]));
            $this->fail('Pajak tanpa versi aturan harus menggagalkan penyimpanan order.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.taxes.0', $e->errors());
        }

        $this->assertSame($before, SalesOrder::query()->count());
    }

    public function test_forbidden_tax_combinations_are_rejected_by_the_service_safety_net(): void {
        $ppn = $this->ppn();

        try {
            app(SalesOrderService::class)->create($this->salesPayload([$ppn, $ppn]));
            $this->fail('Pajak duplikat harus ditolak.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.taxes', $e->errors());
        }
    }

    public function test_the_item_taxes_relation_carries_what_the_client_needs(): void {
        $order = $this->createSalesOrder([$this->ppn(), $this->luxury()]);
        $order->load('items.taxes');

        $taxes = $order->items->first()->toArray()['taxes'];

        $this->assertCount(2, $taxes);
        foreach (['id', 'name', 'rate', 'category', 'behavior', 'thisModel', 'pivot'] as $key) {
            $this->assertArrayHasKey($key, $taxes[0], "items[].taxes[].{$key}");
        }
        $this->assertSame(Tax::CATEGORY_PPN_STANDARD, $taxes[0]['category']);
        $this->assertSame(0, $taxes[0]['pivot']['position']);
        $this->assertSame(1, $taxes[1]['pivot']['position']);
        $this->assertSame('PPN 12, PPnBM 10', $order->items->first()->tax_names);
        $this->assertSame('12%, 10%', $order->items->first()->tax_rates);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Sinkronisasi baris order dari invoice (kunci pengelompokan = himpunan pajak)
    // ---------------------------------------------------------------------------------------------------------

    public function test_syncing_an_order_item_from_an_invoice_carries_the_whole_tax_set(): void {
        $ppn    = $this->ppn();
        $luxury = $this->luxury();
        $order  = $this->createSalesOrder([$ppn]);
        $soItem = $order->items->first();

        $invoice = SalesInvoice::factory()->create(['date' => now(), 'sales_order_id' => $order->id]);
        $invItem = SalesInvoiceItem::factory()->create([
            'sales_invoice_id'    => $invoice->id,
            'sales_order_item_id' => $soItem->id,
            'quantity'            => 10,
            'price'               => 100_000,
            'discount_amount'     => 0,
            'tax_id'              => $ppn->getKey(),
            'tax_rate'            => 12,
        ]);
        $invItem->taxLines()->create(['tax_id' => $ppn->getKey(), 'position' => 0, 'tax_rate' => 12]);
        $invItem->taxLines()->create(['tax_id' => $luxury->getKey(), 'position' => 1, 'tax_rate' => 10]);
        ModelConnection::create(['model_type' => SalesOrder::class, 'model_id' => $order->id, 'reference_type' => SalesInvoice::class, 'reference_id' => $invoice->id]);

        app(SalesOrderService::class)->syncItems($order->fresh());

        $synced = SalesOrderItem::query()->with('taxLines')->findOrFail($soItem->id);
        $this->assertSame([$ppn->getKey(), $luxury->getKey()], $synced->taxLines->pluck('tax_id')->all(), 'Order mengikuti himpunan pajak yang ditagihkan.');
        $expectTax = 110_000 + 1_000_000 * 11 / 12 * 0.10;
        $this->assertEqualsWithDelta($expectTax, $synced->tax_amount, 0.02);
        $this->assertEqualsWithDelta(1_000_000 + $expectTax, (float) $order->fresh()->amount, 0.02);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Purchase Order
    // ---------------------------------------------------------------------------------------------------------

    public function test_a_multi_tax_purchase_order_uses_the_engine_and_keeps_the_base_currency_total(): void {
        $ppn    = $this->ppn();
        $luxury = $this->luxury();

        $order = app(PurchaseOrderService::class)->create($this->purchasePayload([$ppn, $luxury]))->fresh(['items.taxLines']);
        $item  = $order->items->first();

        $expectTax = 110_000 + 1_000_000 * 11 / 12 * 0.10;
        $this->assertSame([$ppn->getKey(), $luxury->getKey()], $item->taxLines->pluck('tax_id')->all());
        $this->assertSame($ppn->getKey(), $item->tax_id);
        $this->assertEqualsWithDelta($expectTax, $item->tax_amount, 0.02);
        $this->assertEqualsWithDelta(1_000_000 + $expectTax, (float) $order->amount, 0.02);
        $this->assertEqualsWithDelta((float) $order->amount * ($order->exchange_rate ?? 1), (float) $order->amount_base_currency, 0.02);
    }

    public function test_a_purchase_order_tax_without_a_rule_version_fails_closed(): void {
        $noRule = Tax::query()->create(['name' => 'Tanpa versi', 'rate' => 11, 'category' => Tax::CATEGORY_PPN_STANDARD]);

        $this->expectException(ValidationException::class);
        app(PurchaseOrderService::class)->create($this->purchasePayload([$noRule]));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Request: normalisasi tax -> taxes dan aturan kombinasi
    // ---------------------------------------------------------------------------------------------------------

    private function purchaseRequestValidator(array $row): Validator {
        $data    = ['items' => [$row]];
        $request = PurchaseOrderRequest::create('/', 'POST', $data);
        $request->setContainer(app());
        (new ReflectionMethod($request, 'prepareForValidation'))->invoke($request);

        $rules     = collect(PurchaseOrderRequest::fieldRules($request))->filter(fn ($rule, string $key): bool => str_starts_with($key, 'items.') && str_contains($key, 'tax'))->all();
        $validator = ValidatorFacade::make($request->all(), $rules);
        $request->withValidator($validator);

        return $validator;
    }

    public function test_the_purchase_order_request_normalizes_a_single_tax_and_requires_at_least_one(): void {
        $tax = TaxFactory::new()->create();

        $single = $this->purchaseRequestValidator(['tax' => ['id' => $tax->id]]);
        $this->assertFalse($single->fails(), 'tax tunggal dinormalisasi menjadi taxes:[tax].');

        $none = $this->purchaseRequestValidator([]);
        $this->assertArrayHasKey('items.0.taxes', $none->errors()->toArray());
    }

    public function test_the_purchase_order_request_rejects_duplicate_and_double_standard_ppn(): void {
        $ppnA = $this->ppn();
        $ppnB = $this->tax('PPN lain', 11, Tax::CATEGORY_PPN_STANDARD);

        $duplicate = $this->purchaseRequestValidator(['taxes' => [['id' => $ppnA->getKey()], ['id' => $ppnA->getKey()]]]);
        $this->assertArrayHasKey('items.0.taxes', $duplicate->errors()->toArray());

        $double = $this->purchaseRequestValidator(['taxes' => [['id' => $ppnA->getKey()], ['id' => $ppnB->getKey()]]]);
        $this->assertArrayHasKey('items.0.taxes', $double->errors()->toArray());

        $tooMany = $this->purchaseRequestValidator(['taxes' => array_map(fn (int $i): array => ['id' => $this->tax("Pajak {$i}", $i, Tax::CATEGORY_UNCLASSIFIED)->getKey()], range(1, 6))]);
        $this->assertArrayHasKey('items.0.taxes', $tooMany->errors()->toArray());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Toleransi penagihan: pajak invoice berbeda dari order
    // ---------------------------------------------------------------------------------------------------------

    public function test_billing_tolerance_aligns_the_invoice_row_taxes_to_the_order_source(): void {
        $ppn    = $this->ppn();
        $pph    = $this->pph();
        $source = new SalesOrderItem;
        $source->setRelation('taxLines', collect([new SalesOrderItemTax(['tax_id' => $ppn->getKey(), 'position' => 0])]));

        $resolver = app(InvoiceBilledValueResolver::class);
        $rows     = [
            ['sales_order_item' => ['id' => 'so-1'], 'taxes' => [['id' => $ppn->getKey()], ['id' => $pph->getKey()]]],
            ['sales_order_item' => ['id' => 'so-1'], 'taxes' => [['id' => $ppn->getKey()]]],
            ['taxes'            => [['id' => $pph->getKey()]]],
        ];

        $aligned = $resolver->alignTaxesToSource($rows, fn (array $row) => isset($row['sales_order_item']) ? $source : null);

        $this->assertSame([['id' => $ppn->getKey()]], $aligned[0]['taxes'], 'PPh yang hanya ada di invoice tidak ikut menggeser nilai yang dibandingkan.');
        $this->assertSame($rows[1], $aligned[1], 'Pajak sama: baris tidak diubah.');
        $this->assertSame($rows[2], $aligned[2], 'Tanpa sumber: baris tidak diubah.');
    }

    public function test_the_sales_invoice_request_class_still_exposes_the_tolerance_hook(): void {
        $this->assertTrue(method_exists(SalesInvoiceRequest::class, 'withValidator'));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Backfill (Requirement 14.10) dan model
    // ---------------------------------------------------------------------------------------------------------

    private function runOrderBackfill(): void {
        (require base_path('database/migrations/2026_11_28_200002_backfill_order_item_taxes.php'))->up();
    }

    public function test_the_backfill_mirrors_stored_order_values_idempotently_with_parity(): void {
        $ppn   = $this->ppn();
        $order = $this->createSalesOrder([$ppn]);
        $item  = $order->items->first();

        // Simulasikan order lama: item punya tax_id tetapi belum punya pivot.
        SalesOrderItemTax::query()->where('sales_order_item_id', $item->id)->delete();
        $before = (float) $item->fresh()->tax_amount;

        $this->runOrderBackfill();
        $this->runOrderBackfill();

        $rows = SalesOrderItemTax::query()->where('sales_order_item_id', $item->id)->get();
        $this->assertCount(1, $rows, 'Idempoten: dijalankan dua kali tetap satu baris.');
        $this->assertSame(0, $rows->first()->position);
        $this->assertNull($rows->first()->tax_rule_version_id, 'Order lama tanpa versi aturan.');
        $this->assertEqualsWithDelta($before, (float) $rows->first()->tax_amount, 0.001, 'Paritas: nilai tersimpan tidak berubah.');
        $this->assertEqualsWithDelta($before, (float) $item->fresh()->tax_amount, 0.001, 'Item tidak dihitung ulang.');
    }

    public function test_the_backfill_down_only_empties_the_pivot_rows(): void {
        $order = $this->createSalesOrder([$this->ppn()]);
        $this->assertSame(1, SalesOrderItemTax::query()->count());

        (require base_path('database/migrations/2026_11_28_200002_backfill_order_item_taxes.php'))->down();

        $this->assertSame(0, SalesOrderItemTax::query()->count());
        $this->assertTrue(Schema::hasTable('sales_order_item_taxes'));
        $this->assertTrue(Schema::hasTable('purchase_order_item_taxes'));
        $this->assertTrue(Schema::hasTable('quotation_item_taxes'));
        $this->assertNotNull($order->items->first()->tax_id, 'Kolom item tidak berubah.');
    }

    public function test_the_order_pivot_tables_declare_the_agreed_columns_and_short_index_names(): void {
        foreach (['quotation_item_taxes' => 'quotation_item_id', 'sales_order_item_taxes' => 'sales_order_item_id', 'purchase_order_item_taxes' => 'purchase_order_item_id'] as $table => $foreignKey) {
            foreach (['id', $foreignKey, 'tax_id', 'tax_rule_version_id', 'position', 'tax_rate', 'dpp_factor', 'base_amount', 'dpp_amount', 'tax_amount', 'withholding_amount'] as $column) {
                $this->assertTrue(Schema::hasColumn($table, $column), "{$table}.{$column}");
            }
            $unique = collect(Schema::getIndexes($table))->first(fn (array $index): bool => $index['unique'] && ! $index['primary']);
            $this->assertSame([$foreignKey, 'tax_id'], $unique['columns']);
            $this->assertLessThanOrEqual(64, max(array_map('strlen', array_column(Schema::getIndexes($table), 'name'))));
        }
    }
}
