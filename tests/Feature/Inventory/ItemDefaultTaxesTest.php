<?php

namespace Tests\Feature\Inventory;

use App\Enums\DefaultsDocumentType;
use App\Http\Requests\Inventory\ItemRequest;
use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\DocumentDefaultsResolver;
use App\Services\Inventory\ItemServices;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Tests\TestCase;

/**
 * Pajak default per item master (spek finance-multi-tax-per-item, Task 11; Requirement 15): relasi dan sinkron berurut,
 * validasi kombinasi pada request Item, serta prioritas `DocumentDefaultsResolver::resolveForItems()` (Q-MT-13:
 * default item > aturan bersyarat > default modul; satu query massal; pajak terhapus lunak dilewati).
 */
class ItemDefaultTaxesTest extends TestCase {
    use RefreshDatabase;

    private function tax(string $name, float $rate, string $category = Tax::CATEGORY_UNCLASSIFIED): Tax {
        return Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => $category]);
    }

    /**
     * @param  list<Tax>  $taxes
     * @return list<array{id: string}>
     */
    private function objects(array $taxes): array {
        return array_map(fn (Tax $tax): array => ['id' => $tax->getKey()], $taxes);
    }

    private function resolve(DefaultsDocumentType $type, Item ...$items): array {
        return app(DocumentDefaultsResolver::class)->resolveForItems($type, array_map(fn (Item $item): string => $item->id, $items));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Skema, relasi, sinkron
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_default_taxes_table_declares_the_agreed_columns_and_a_unique_item_module_tax_index(): void {
        foreach (['item_id', 'tax_id', 'module', 'position', 'created_at', 'updated_at'] as $column) {
            $this->assertTrue(Schema::hasColumn('item_default_taxes', $column), $column);
        }

        $unique = collect(Schema::getIndexes('item_default_taxes'))->first(fn (array $index): bool => $index['unique']);
        $this->assertSame(['item_id', 'module', 'tax_id'], $unique['columns']);
    }

    public function test_sync_stores_both_modules_in_choice_order_and_independently(): void {
        $item = Item::factory()->create();
        $ppn  = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $pph  = $this->tax('PPh', 2);
        $lux  = $this->tax('PPnBM', 10, Tax::CATEGORY_PPN_LUXURY);

        app(ItemServices::class)->syncDefaultTaxes($item, [
            'default_sales_taxes'    => $this->objects([$pph, $ppn]),
            'default_purchase_taxes' => $this->objects([$lux]),
        ]);

        $this->assertSame([$pph->getKey(), $ppn->getKey()], $item->salesDefaultTaxes()->get()->pluck('id')->all(), 'Urut sesuai pilihan (position 0 = Pajak Utama).');
        $this->assertSame([$lux->getKey()], $item->purchaseDefaultTaxes()->get()->pluck('id')->all());
        $this->assertSame(2, DB::table('item_default_taxes')->where('module', 'sales')->count());
        $this->assertSame(1, DB::table('item_default_taxes')->where('module', 'purchase')->count());
        $this->assertSame(3, DB::table('item_default_taxes')->count());
    }

    public function test_resync_replaces_reorders_and_empty_array_clears_while_null_keeps(): void {
        $item = Item::factory()->create();
        $a    = $this->tax('A', 1);
        $b    = $this->tax('B', 2);
        $c    = $this->tax('C', 3);
        $svc  = app(ItemServices::class);

        $svc->syncDefaultTaxes($item, ['default_sales_taxes' => $this->objects([$a, $b])]);
        $svc->syncDefaultTaxes($item, ['default_sales_taxes' => $this->objects([$c, $a])]);
        $this->assertSame([$c->getKey(), $a->getKey()], $item->salesDefaultTaxes()->get()->pluck('id')->all());

        $svc->syncDefaultTaxes($item, ['default_purchase_taxes' => $this->objects([$b])]);
        $svc->syncDefaultTaxes($item, ['default_sales_taxes' => null]);
        $this->assertCount(2, $item->salesDefaultTaxes()->get(), 'null tidak mengubah default modul itu.');
        $this->assertCount(1, $item->purchaseDefaultTaxes()->get(), 'Sinkron penjualan tidak menyentuh pembelian.');

        $svc->syncDefaultTaxes($item, ['default_sales_taxes' => []]);
        $this->assertCount(0, $item->salesDefaultTaxes()->get());
        $this->assertCount(1, $item->purchaseDefaultTaxes()->get());
    }

    public function test_the_same_tax_cannot_be_stored_twice_for_one_item_and_module(): void {
        $item = Item::factory()->create();
        $tax  = $this->tax('A', 1);
        $item->salesDefaultTaxes()->attach($tax->getKey(), ['position' => 0]);

        $this->expectException(QueryException::class);
        $item->salesDefaultTaxes()->attach($tax->getKey(), ['position' => 1]);
    }

    public function test_default_taxes_are_removed_with_their_item(): void {
        $item = Item::factory()->create();
        $item->salesDefaultTaxes()->attach($this->tax('A', 1)->getKey(), ['position' => 0]);

        DB::table('items')->where('id', $item->id)->delete();

        $this->assertSame(0, DB::table('item_default_taxes')->count());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Request Item
    // ---------------------------------------------------------------------------------------------------------

    private function requestValidator(array $data): Validator {
        $request = ItemRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $rules     = collect($request->rules())->filter(fn ($rule, string $key): bool => str_contains($key, '_taxes'))->all();
        $validator = ValidatorFacade::make($data, $rules);
        $request->withValidator($validator);

        return $validator;
    }

    public function test_the_item_request_accepts_valid_default_taxes_and_rejects_forbidden_combinations(): void {
        $ppnA = $this->tax('PPN A', 12, Tax::CATEGORY_PPN_STANDARD);
        $ppnB = $this->tax('PPN B', 11, Tax::CATEGORY_PPN_STANDARD);
        $pph  = $this->tax('PPh', 2);

        $this->assertFalse($this->requestValidator(['default_sales_taxes' => $this->objects([$ppnA, $pph])])->fails());
        $this->assertFalse($this->requestValidator([])->fails(), 'Field boleh tidak dikirim.');

        $duplicate = $this->requestValidator(['default_sales_taxes' => $this->objects([$pph, $pph])]);
        $this->assertArrayHasKey('default_sales_taxes', $duplicate->errors()->toArray());

        $double = $this->requestValidator(['default_purchase_taxes' => $this->objects([$ppnA, $ppnB])]);
        $this->assertArrayHasKey('default_purchase_taxes', $double->errors()->toArray());

        $many = array_map(fn (int $i): Tax => $this->tax("Pajak {$i}", $i), range(1, 6));
        $this->assertTrue($this->requestValidator(['default_sales_taxes' => $this->objects($many)])->fails(), 'Maksimal 5 pajak.');

        $missing = $this->requestValidator(['default_sales_taxes' => [['id' => '01HZZZZZZZZZZZZZZZZZZZZZZZ']]]);
        $this->assertTrue($missing->fails(), 'Pajak harus ada.');
    }

    public function test_a_soft_deleted_tax_is_not_accepted_as_a_new_default(): void {
        $tax = $this->tax('Dihapus', 5);
        $tax->delete();

        $this->assertTrue($this->requestValidator(['default_sales_taxes' => [['id' => $tax->getKey()]]])->fails());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Resolver: prioritas Q-MT-13
    // ---------------------------------------------------------------------------------------------------------

    public function test_item_defaults_win_over_conditional_rules_and_module_defaults(): void {
        $moduleTax = $this->tax('Modul', 11);
        $ruleTax   = $this->tax('Aturan', 5);
        $ppn       = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $pph       = $this->tax('PPh', 2);
        $category  = Category::query()->create(['name' => 'Parts', 'type' => 'inventory']);
        $item      = Item::factory()->create(['type' => 'goods', 'is_stock_item' => true, 'category_id' => $category->id]);
        $plain     = Item::factory()->create(['type' => 'goods', 'is_stock_item' => true, 'category_id' => $category->id]);

        SalesSetting::current()->fill(['default_tax_id' => $moduleTax->id])->save();
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_order', 'item_type' => 'goods', 'is_stock_item' => true, 'item_category_id' => $category->id, 'tax_id' => $ruleTax->id, 'priority' => 0]);
        app(ItemServices::class)->syncDefaultTaxes($item, ['default_sales_taxes' => $this->objects([$ppn, $pph])]);

        $resolved = $this->resolve(DefaultsDocumentType::SalesOrder, $item, $plain);

        $this->assertSame([$ppn->getKey(), $pph->getKey()], $resolved[$item->id]['tax_ids'], 'Seluruh pajak default item, berurut.');
        $this->assertSame([$ppn->getKey(), $pph->getKey()], array_column($resolved[$item->id]['taxes'], 'id'));
        $this->assertSame('PPN', $resolved[$item->id]['taxes'][0]['name']);
        $this->assertFalse($resolved[$item->id]['tax_optional']);
        $this->assertSame([$ruleTax->getKey()], $resolved[$plain->id]['tax_ids'], 'Tanpa default item: aturan bersyarat.');
    }

    public function test_the_module_default_is_used_when_there_is_no_item_default_and_no_rule(): void {
        $moduleTax = $this->tax('Modul', 11);
        $item      = Item::factory()->create();
        PurchaseSetting::current()->fill(['default_tax_id' => $moduleTax->id])->save();

        $resolved = $this->resolve(DefaultsDocumentType::PurchaseOrder, $item);

        $this->assertSame([$moduleTax->getKey()], $resolved[$item->id]['tax_ids']);
    }

    public function test_sales_and_purchase_documents_read_their_own_module_defaults(): void {
        $salesTax    = $this->tax('Jual', 12, Tax::CATEGORY_PPN_STANDARD);
        $purchaseTax = $this->tax('Beli', 11, Tax::CATEGORY_PPN_STANDARD);
        $item        = Item::factory()->create();
        app(ItemServices::class)->syncDefaultTaxes($item, [
            'default_sales_taxes'    => $this->objects([$salesTax]),
            'default_purchase_taxes' => $this->objects([$purchaseTax]),
        ]);

        foreach ([DefaultsDocumentType::Quotation, DefaultsDocumentType::SalesOrder, DefaultsDocumentType::SalesInvoice] as $type) {
            $this->assertSame([$salesTax->getKey()], $this->resolve($type, $item)[$item->id]['tax_ids'], $type->value);
        }
        foreach ([DefaultsDocumentType::PurchaseOrder, DefaultsDocumentType::PurchaseInvoice] as $type) {
            $this->assertSame([$purchaseTax->getKey()], $this->resolve($type, $item)[$item->id]['tax_ids'], $type->value);
        }
        foreach ([DefaultsDocumentType::DeliveryNote, DefaultsDocumentType::PurchaseReceipt] as $type) {
            $this->assertSame([], $this->resolve($type, $item)[$item->id]['tax_ids'], "{$type->value} tidak berpajak.");
        }
    }

    public function test_soft_deleted_default_taxes_are_skipped_and_an_all_broken_default_falls_through(): void {
        $moduleTax = $this->tax('Modul', 11);
        $live      = $this->tax('Hidup', 12, Tax::CATEGORY_PPN_STANDARD);
        $gone      = $this->tax('Dihapus', 2);
        $partial   = Item::factory()->create();
        $broken    = Item::factory()->create();
        SalesSetting::current()->fill(['default_tax_id' => $moduleTax->id])->save();

        app(ItemServices::class)->syncDefaultTaxes($partial, ['default_sales_taxes' => $this->objects([$gone, $live])]);
        app(ItemServices::class)->syncDefaultTaxes($broken, ['default_sales_taxes' => $this->objects([$gone])]);
        $gone->delete();

        $resolved = $this->resolve(DefaultsDocumentType::SalesOrder, $partial, $broken);

        $this->assertSame([$live->getKey()], $resolved[$partial->id]['tax_ids'], 'Pajak terhapus tidak diisikan diam-diam; sisanya tetap.');
        $this->assertSame([$moduleTax->getKey()], $resolved[$broken->id]['tax_ids'], 'Default item seluruhnya rusak jatuh ke tingkat berikutnya.');
    }

    public function test_tax_optional_comes_only_from_a_conditional_rule(): void {
        $moduleTax = $this->tax('Modul', 11);
        $ppn       = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $category  = Category::query()->create(['name' => 'Jasa', 'type' => 'service']);
        $withItem  = Item::factory()->create(['type' => 'service', 'is_stock_item' => false, 'category_id' => $category->id]);
        $noItem    = Item::factory()->create(['type' => 'service', 'is_stock_item' => false, 'category_id' => $category->id]);
        SalesSetting::current()->fill(['default_tax_id' => $moduleTax->id])->save();
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_order', 'item_type' => 'service', 'is_stock_item' => false, 'item_category_id' => $category->id, 'tax_id' => null, 'priority' => 0]);
        app(ItemServices::class)->syncDefaultTaxes($withItem, ['default_sales_taxes' => $this->objects([$ppn])]);

        $resolved = $this->resolve(DefaultsDocumentType::SalesOrder, $withItem, $noItem);

        $this->assertFalse($resolved[$withItem->id]['tax_optional'], 'Default item mengisi pajak; bukan "tanpa pajak".');
        $this->assertSame([$ppn->getKey()], $resolved[$withItem->id]['tax_ids']);
        $this->assertTrue($resolved[$noItem->id]['tax_optional'], 'Aturan "tanpa pajak" eksplisit tetap berlaku untuk item tanpa default.');
        $this->assertSame([], $resolved[$noItem->id]['tax_ids']);
    }

    public function test_the_resolver_reads_item_default_taxes_with_one_query_for_many_items(): void {
        $tax   = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $items = [];
        for ($i = 0; $i < 4; $i++) {
            $items[$i] = Item::factory()->create();
            app(ItemServices::class)->syncDefaultTaxes($items[$i], ['default_sales_taxes' => $this->objects([$tax])]);
        }

        $queries = 0;
        DB::listen(function ($query) use (&$queries): void {
            if (str_contains($query->sql, 'item_default_taxes')) {
                $queries++;
            }
        });

        $resolved = $this->resolve(DefaultsDocumentType::SalesOrder, ...$items);

        $this->assertCount(4, $resolved);
        $this->assertSame(1, $queries, 'Satu query massal untuk semua item (tanpa N+1).');
    }
}
