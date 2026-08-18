<?php

namespace Tests\Feature;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Finances\SalesInvoiceService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Setara SalesOrderDiscountPersistenceTest, tapi untuk SalesInvoiceItem yang
 * skemanya BEDA dari SalesOrderItem: basic_amount TETAP generated column
 * (quantity * price), diskon disimpan di kolom discount_amount terpisah -- bukan
 * menimpa basic_amount. dpp_amount/tax_amount mengikuti secara generated dari
 * (basic_amount - discount_amount). Lihat migration
 * add_discount_amount_to_sales_invoice_items_table.
 */
class SalesInvoiceDiscountPersistenceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, SalesOrder::class, SalesInvoice::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

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
     * @return array{item_id: string, so_item_id: string}
     */
    private function createSalesOrderItemFixture(string $salesOrderId, float $price, float $taxRate): array {
        $itemVariant = ItemVariantFactory::new()->create();
        $tax         = TaxFactory::new()->create(['rate' => $taxRate]);

        $soItemId = (string) Str::ulid();
        DB::table('sales_order_items')->insert([
            'id'                 => $soItemId,
            'sales_order_id'     => $salesOrderId,
            'item_id'            => $itemVariant->id,
            'quantity'           => 10,
            'price'              => $price,
            'tax_id'             => $tax->id,
            'tax_rate'           => $taxRate,
            'delivered_quantity' => 10,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        return ['item_id' => $itemVariant->id, 'so_item_id' => $soItemId];
    }

    /**
     * Line 1 = 10x100.000 @ PPN 11%, line 2 = 10x200.000 @ 10%.
     */
    private function createInvoiceViaService(?string $discountOn = null, float $discountRate = 0, float $discountAmount = 0): SalesInvoice {
        $country        = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer       = CustomerFactory::new()->create(['country_id' => $country->code]);
        $customerBranch = Branch::where('branchable_type', Customer::class)
            ->where('branchable_id', $customer->id)
            ->where('is_main_branch', true)
            ->firstOrFail();

        $salesOrderId = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'            => $salesOrderId,
            'code'          => 'SO-TEST-' . Str::random(8),
            'date'          => now(),
            'customer_id'   => $customer->id,
            'created_by_id' => Auth::id(),
            'amount'        => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $line1 = $this->createSalesOrderItemFixture($salesOrderId, 100000, 11);
        $line2 = $this->createSalesOrderItemFixture($salesOrderId, 200000, 10);

        $debitAccount  = Account::create(['account_name' => 'AR', 'account_number' => '1200', 'root_type' => 'asset', 'account_type' => 'accounts_receivable', 'report_type' => 'balance_sheet']);
        $incomeAccount = Account::create(['account_name' => 'Sales', 'account_number' => '4000', 'root_type' => 'income', 'account_type' => 'sales', 'report_type' => 'profit_and_loss']);

        $payload = [
            'sales_order'     => ['id' => $salesOrderId],
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $customerBranch->id],
            'income_account'  => ['id' => $incomeAccount->id],
            'debit_account'   => ['id' => $debitAccount->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => now()->toDateString(),
            'discount_on'     => $discountOn,
            'discount_rate'   => $discountRate,
            'discount_amount' => $discountAmount,
            'items'           => [
                [
                    'id'               => (string) Str::ulid(),
                    'sales_order_item' => ['id' => $line1['so_item_id']],
                    'unit'             => ['id' => null],
                    'tax'              => ['id' => DB::table('sales_order_items')->where('id', $line1['so_item_id'])->value('tax_id')],
                    'quantity'         => 10,
                    'price'            => 100000,
                ],
                [
                    'id'               => (string) Str::ulid(),
                    'sales_order_item' => ['id' => $line2['so_item_id']],
                    'unit'             => ['id' => null],
                    'tax'              => ['id' => DB::table('sales_order_items')->where('id', $line2['so_item_id'])->value('tax_id')],
                    'quantity'         => 10,
                    'price'            => 200000,
                ],
            ],
        ];

        return app(SalesInvoiceService::class)->create($payload);
    }

    public function test_create_without_discount_basic_amount_stays_gross(): void {
        $salesInvoice = $this->createInvoiceViaService();
        $salesInvoice = $salesInvoice->fresh(['items']);

        $this->assertEqualsWithDelta(3000000, $salesInvoice->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(0, $salesInvoice->items->sum('discount_amount'), 0.01);

        $expectedDpp = 3000000 * 11 / 12;
        $this->assertEqualsWithDelta($expectedDpp, $salesInvoice->items->sum('dpp_amount'), 0.01);
    }

    public function test_create_with_discount_on_net_total_reduces_dpp_via_discount_column(): void {
        $salesInvoice = $this->createInvoiceViaService('net_total', 10, 300000);
        $salesInvoice = $salesInvoice->fresh(['items']);

        $this->assertEqualsWithDelta(3000000, $salesInvoice->items->sum('basic_amount'), 0.01, 'basic_amount kotor tidak boleh berubah');
        $this->assertEqualsWithDelta(300000, $salesInvoice->items->sum('discount_amount'), 0.01);

        $expectedNetBasic = 3000000 - 300000;
        $expectedDpp      = $expectedNetBasic * 11 / 12;
        $this->assertEqualsWithDelta($expectedDpp, $salesInvoice->items->sum('dpp_amount'), 0.01, 'DPP harus dihitung dari basic_amount setelah diskon');

        $expectedTax = $salesInvoice->items->sum('tax_amount');
        $this->assertEqualsWithDelta($expectedNetBasic + $expectedTax, $salesInvoice->amount, 0.01);
    }

    public function test_reload_from_db_matches_in_memory_after_save(): void {
        $salesInvoice = $this->createInvoiceViaService('net_total', 10, 300000);

        $reloaded = $salesInvoice->fresh(['items']);
        $this->assertEqualsWithDelta($salesInvoice->amount, $reloaded->amount, 0.01);
        $this->assertEqualsWithDelta(
            $salesInvoice->items()->sum('discount_amount'),
            $reloaded->items->sum('discount_amount'),
            0.01,
        );
    }
}
