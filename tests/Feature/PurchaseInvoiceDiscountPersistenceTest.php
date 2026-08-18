<?php

namespace Tests\Feature;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Finances\PurchaseInvoiceService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Setara PurchaseOrderDiscountPersistenceTest, tapi untuk PurchaseInvoiceItem yang
 * skemanya BEDA dari PurchaseOrderItem: basic_amount TETAP generated column
 * (quantity * rate), diskon disimpan di kolom discount_amount terpisah -- bukan
 * menimpa basic_amount. dpp_amount/tax_amount/amount mengikuti secara generated
 * dari (basic_amount - discount_amount). Lihat migration
 * add_discount_amount_to_purchase_invoice_items_table.
 */
class PurchaseInvoiceDiscountPersistenceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseInvoice::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (! Schema::hasColumn('suppliers', 'lft')) {
            Schema::table('suppliers', function ($t) {
                $t->unsignedInteger('lft')->default(0);
                $t->unsignedInteger('rgt')->default(0);
                $t->unsignedInteger('depth')->default(0);
            });
        }

        if (! Schema::hasColumn('accounts', 'lft')) {
            Schema::table('accounts', function ($t) {
                $t->unsignedInteger('lft')->default(0);
                $t->unsignedInteger('rgt')->default(0);
                $t->unsignedInteger('depth')->default(0);
            });
        }

        Auth::login(User::factory()->create());
    }

    /**
     * @return array{item_id: string, unit_id: string, po_item_id: string}
     */
    private function createPurchaseOrderItemFixture(string $purchaseOrderId, float $rate, float $taxRate): array {
        $unit        = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $item        = Item::factory()->create(['default_unit_id' => $unit->id]);
        $itemVariant = ItemVariantFactory::new()->for($item, 'item')->create();

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $itemUnitId,
            'item_id'    => $itemVariant->item_id,
            'unit_id'    => $itemVariant->default_unit_id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $tax = TaxFactory::new()->create(['rate' => $taxRate]);

        $poItemId = (string) Str::ulid();
        DB::table('purchase_order_items')->insert([
            'id'                => $poItemId,
            'purchase_order_id' => $purchaseOrderId,
            'item_id'           => $itemVariant->id,
            'item_unit_id'      => $itemUnitId,
            'quantity'          => 10,
            'rate'              => $rate,
            'tax_id'            => $tax->id,
            'tax_rate'          => $taxRate,
            'received_quantity' => 10,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return ['item_id' => $itemVariant->id, 'unit_id' => $itemUnitId, 'po_item_id' => $poItemId];
    }

    /**
     * Line 1 = 10x100.000 @ PPN 11%, line 2 = 10x200.000 @ 10% -- fixture sama
     * proporsi dengan PurchaseOrderDiscountPersistenceTest (basic_amount total
     * 3.000.000, tax 210.000 [line1] + 200.000 [line2] pada basis 10x).
     */
    private function createInvoiceViaService(?string $discountOn = null, float $discountRate = 0, float $discountAmount = 0): PurchaseInvoice {
        $country  = CountryFactory::new()->create();
        $supplier = Supplier::query()->create(['name' => 'PT Test Supplier', 'is_disabled' => false, 'country_id' => $country->code]);

        $purchaseOrderId = (string) Str::ulid();
        DB::table('purchase_orders')->insert([
            'id'            => $purchaseOrderId,
            'code'          => 'PO-TEST-' . Str::random(8),
            'date'          => now(),
            'supplier_id'   => $supplier->id,
            'created_by_id' => Auth::id(),
            'amount'        => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $line1 = $this->createPurchaseOrderItemFixture($purchaseOrderId, 100000, 11);
        $line2 = $this->createPurchaseOrderItemFixture($purchaseOrderId, 200000, 10);

        $expenseAccount = Account::create(['account_name' => 'Expense', 'account_number' => '5000', 'root_type' => 'expense', 'account_type' => 'expense', 'report_type' => 'profit_and_loss']);
        $creditAccount  = Account::create(['account_name' => 'Creditors', 'account_number' => '2000', 'root_type' => 'liability', 'account_type' => 'creditors', 'report_type' => 'balance_sheet']);

        $payload = [
            'purchase_order'       => ['id' => $purchaseOrderId],
            'supplier'             => ['id' => $supplier->id],
            'branch'               => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'                 => now()->toDateString(),
            'expense_head_account' => ['id' => $expenseAccount->id],
            'credit_account'       => ['id' => $creditAccount->id],
            'discount_on'          => $discountOn,
            'discount_rate'        => $discountRate,
            'discount_amount'      => $discountAmount,
            'items'                => [
                [
                    'id'                  => (string) Str::ulid(),
                    'purchase_order_item' => ['id' => $line1['po_item_id']],
                    'unit'                => ['id' => $line1['unit_id']],
                    'tax'                 => ['id' => DB::table('purchase_order_items')->where('id', $line1['po_item_id'])->value('tax_id')],
                    'quantity'            => 10,
                    'rate'                => 100000,
                ],
                [
                    'id'                  => (string) Str::ulid(),
                    'purchase_order_item' => ['id' => $line2['po_item_id']],
                    'unit'                => ['id' => $line2['unit_id']],
                    'tax'                 => ['id' => DB::table('purchase_order_items')->where('id', $line2['po_item_id'])->value('tax_id')],
                    'quantity'            => 10,
                    'rate'                => 200000,
                ],
            ],
        ];

        return app(PurchaseInvoiceService::class)->create($payload);
    }

    public function test_create_without_discount_basic_amount_stays_gross(): void {
        $purchaseInvoice = $this->createInvoiceViaService();
        $purchaseInvoice = $purchaseInvoice->fresh(['items']);

        // Tanpa diskon: basic_amount (kotor) == basic_amount setelah "diskon" (0)
        $this->assertEqualsWithDelta(3000000, $purchaseInvoice->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(0, $purchaseInvoice->items->sum('discount_amount'), 0.01);

        // dpp_amount = basic_amount * 11/12 (tidak dipotong diskon karena tidak ada diskon)
        $expectedDpp = 3000000 * 11 / 12;
        $this->assertEqualsWithDelta($expectedDpp, $purchaseInvoice->items->sum('dpp_amount'), 0.01);
    }

    public function test_create_with_discount_on_net_total_reduces_dpp_via_discount_column(): void {
        // Diskon 10% dari net_total (basis = sum basic_amount kotor = 3.000.000) = 300.000
        $purchaseInvoice = $this->createInvoiceViaService('net_total', 10, 300000);
        $purchaseInvoice = $purchaseInvoice->fresh(['items']);

        // basic_amount KOTOR tetap tidak berubah (masih generated quantity*rate)
        $this->assertEqualsWithDelta(3000000, $purchaseInvoice->items->sum('basic_amount'), 0.01);

        // discount_amount total harus == nominal diskon yang diinput
        $this->assertEqualsWithDelta(300000, $purchaseInvoice->items->sum('discount_amount'), 0.01, 'discount_amount harus menyimpan alokasi diskon per baris');

        // dpp_amount = (basic_amount - discount_amount) * 11/12 -- DPP tereskalasi turun
        $expectedNetBasic = 3000000 - 300000;
        $expectedDpp      = $expectedNetBasic * 11 / 12;
        $this->assertEqualsWithDelta($expectedDpp, $purchaseInvoice->items->sum('dpp_amount'), 0.01, 'DPP harus dihitung dari basic_amount setelah diskon, bukan beku');

        // amount header (Total) = (basic_amount - discount_amount) + tax_amount
        $expectedTax = $purchaseInvoice->items->sum('tax_amount');
        $this->assertEqualsWithDelta($expectedNetBasic + $expectedTax, $purchaseInvoice->amount, 0.01);
    }

    public function test_create_with_discount_on_grand_total(): void {
        $probe      = $this->createInvoiceViaService();
        $grossBasic = $probe->items()->sum('basic_amount');

        $purchaseInvoice = $this->createInvoiceViaService('grand_total', 10, 200000);
        $purchaseInvoice = $purchaseInvoice->fresh(['items']);

        // basic_amount kotor tetap sama untuk kedua invoice (fixture identik) --
        // diskon TIDAK menimpa basic_amount, hanya discount_amount yang berubah.
        $this->assertEqualsWithDelta($grossBasic, $purchaseInvoice->items->sum('basic_amount'), 0.01);

        // Diskon harus teralokasi (bukan 0) dan Total harus tetap invarian
        // (basic_amount - discount_amount) + tax_amount, terlepas basis diskon mana
        // yang dipilih -- formula proporsi grand_total sendiri sudah divalidasi
        // DocumentDiscountCalculatorTest, di sini cukup verifikasi integrasi Service.
        $this->assertGreaterThan(0, $purchaseInvoice->items->sum('discount_amount'), 'discount_amount harus teralokasi untuk basis grand_total');

        $expectedNetBasic = $purchaseInvoice->items->sum('basic_amount') - $purchaseInvoice->items->sum('discount_amount');
        $expectedTax      = $purchaseInvoice->items->sum('tax_amount');
        $this->assertEqualsWithDelta($expectedNetBasic + $expectedTax, $purchaseInvoice->amount, 0.01);
    }

    public function test_reload_from_db_matches_in_memory_after_save(): void {
        $purchaseInvoice = $this->createInvoiceViaService('net_total', 10, 300000);

        $reloaded = $purchaseInvoice->fresh(['items']);
        $this->assertEqualsWithDelta($purchaseInvoice->amount, $reloaded->amount, 0.01);
        $this->assertEqualsWithDelta(
            $purchaseInvoice->items()->sum('discount_amount'),
            $reloaded->items->sum('discount_amount'),
            0.01,
        );
    }
}
