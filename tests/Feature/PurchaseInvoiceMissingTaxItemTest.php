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
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Regresi: submit Purchase Invoice dengan baris item yang tidak punya `tax`
 * sama sekali (mis. item non-PPN, atau baris yang belum di-pilih pajaknya)
 * dulu crash "Undefined array key 'tax'" di PurchaseInvoiceService::fillItemRelations()
 * -- baris `$data['tax_id'] = $data['tax']['id'];` tidak null-safe, beda dari
 * PurchaseOrderService::fillItemRelations() yang sudah benar pakai `?? null`
 * untuk field opsional yang sama persis.
 */
class PurchaseInvoiceMissingTaxItemTest extends TestCase {
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

    public function test_create_with_item_missing_tax_key_does_not_crash(): void {
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

        $poItemId = (string) Str::ulid();
        DB::table('purchase_order_items')->insert([
            'id'                => $poItemId,
            'purchase_order_id' => $purchaseOrderId,
            'item_id'           => $itemVariant->id,
            'item_unit_id'      => $itemUnitId,
            'quantity'          => 10,
            'rate'              => 100000,
            'received_quantity' => 10,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $expenseAccount = Account::create(['account_name' => 'Expense', 'account_number' => '5000', 'root_type' => 'expense', 'account_type' => 'expense', 'report_type' => 'profit_and_loss']);
        $creditAccount  = Account::create(['account_name' => 'Creditors', 'account_number' => '2000', 'root_type' => 'liability', 'account_type' => 'creditors', 'report_type' => 'balance_sheet']);

        $payload = [
            'purchase_order'       => ['id' => $purchaseOrderId],
            'supplier'             => ['id' => $supplier->id],
            'branch'               => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'                 => now()->toDateString(),
            'expense_head_account' => ['id' => $expenseAccount->id],
            'credit_account'       => ['id' => $creditAccount->id],
            'items'                => [
                [
                    'id'                  => (string) Str::ulid(),
                    'purchase_order_item' => ['id' => $poItemId],
                    'unit'                => ['id' => $itemUnitId],
                    // Sengaja TIDAK ada key 'tax' -- ini persis skenario yang crash.
                    'quantity' => 10,
                    'rate'     => 100000,
                ],
            ],
        ];

        $purchaseInvoice = app(PurchaseInvoiceService::class)->create($payload);
        $purchaseInvoice = $purchaseInvoice->fresh(['items']);

        $this->assertCount(1, $purchaseInvoice->items);
        $this->assertNull($purchaseInvoice->items->first()->tax_id);
        $this->assertEquals(0, $purchaseInvoice->items->first()->tax_rate);
    }
}
