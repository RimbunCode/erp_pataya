<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Finances\PurchaseInvoiceService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Task 5.6 — Dispatch Correctness: FixedAssetItemApproved dipicu tepat untuk
 * item fixed-asset saja saat PurchaseInvoiceService::onApproved() dipanggil
 * lewat jalur penuh, termasuk skenario >1 fixed-asset item dalam satu invoice.
 */
class PurchaseInvoiceServiceFixedAssetDispatchTest extends TestCase {
    use RefreshDatabase;

    private PurchaseInvoiceService $service;
    private User $testUser;
    private Account $creditAccount;
    private Account $expenseAccount;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new PurchaseInvoiceService;

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([
            FormatingSeries::class,
            Supplier::class,
            PurchaseOrder::class,
            PurchaseInvoice::class,
            GeneralLedger::class,
        ] as $model) {
            $model::initPermissions();
        }

        // Account pakai trait TreeView (bootTreeView mengisi lft/rgt/depth saat
        // creating), tapi kolomnya TIDAK ada di migration create_accounts_table
        // — normalnya diisi Account::initPermissions(). Tidak dipanggil langsung
        // di sini karena method itu men-create index dgn nama HARDCODE global
        // 'lft_index' (bug pre-existing DataTable::initPermissions(), di luar
        // scope task 5.6) yang bentrok kalau model tree-view lain (mis.
        // AssetLocation) sudah lebih dulu membuat index dgn nama sama pada
        // proses test yang sama — jadi kolom ditambah manual tanpa index.
        if (! Schema::hasColumns('accounts', ['lft', 'rgt', 'depth'])) {
            Schema::table('accounts', function ($table) {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            });
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        CountryFactory::new()->create(['code' => 'IDN']);
        $this->testUser = User::factory()->create();

        $this->creditAccount = Account::create([
            'account_name'   => 'Accounts Payable',
            'account_number' => '2000',
            'root_type'      => 'liability',
            'report_type'    => 'balance_sheet',
        ]);
        $this->expenseAccount = Account::create([
            'account_name'   => 'Expense Head',
            'account_number' => '5000',
            'root_type'      => 'expense',
            'report_type'    => 'profit_and_loss',
        ]);
    }

    private function withoutModelEvents(callable $callback) {
        return BaseModel::withoutEvents($callback);
    }

    private function makePoItem(Item $item, float $quantity, string $warehouseId): PurchaseOrderItem {
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $supplier = SupplierFactory::new()->create();

        $this->actingAs($this->testUser);
        $po = $this->withoutModelEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));

        return PurchaseOrderItem::create([
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
            'rate'                => 1000,
            'target_warehouse_id' => $warehouseId,
        ]);
    }

    private function makeInvoice(string $purchaseOrderId): PurchaseInvoice {
        return $this->withoutModelEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $purchaseOrderId,
            'credit_account_id'       => $this->creditAccount->id,
            'expanse_head_account_id' => $this->expenseAccount->id,
            'created_by_id'           => $this->testUser->id,
        ]));
    }

    #[Test]
    public function dispatches_event_only_for_fixed_asset_items_among_mixed_items(): void {
        Event::fake([FixedAssetItemApproved::class]);

        $warehouse = WarehouseFactory::new()->create();

        $fixedAssetItemA = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $fixedAssetItemB = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $regularItem     = ItemFactory::new()->create(['is_fixed_asset' => false]);

        $poItemA = $this->makePoItem($fixedAssetItemA, 1, $warehouse->id);
        $poItemB = $this->makePoItem($fixedAssetItemB, 1, $warehouse->id);
        $poItemC = $this->makePoItem($regularItem, 5, $warehouse->id);

        $invoice = $this->makeInvoice($poItemA->purchase_order_id);

        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItemA->id,
            'item_id'                => $poItemA->item_id,
            'quantity'               => 1,
            'rate'                   => 1000,
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItemB->id,
            'item_id'                => $poItemB->item_id,
            'quantity'               => 1,
            'rate'                   => 1000,
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItemC->id,
            'item_id'                => $poItemC->item_id,
            'quantity'               => 5,
            'rate'                   => 1000,
        ]);

        $this->service->onApproved($invoice);

        Event::assertDispatchedTimes(FixedAssetItemApproved::class, 2);
        Event::assertDispatched(FixedAssetItemApproved::class, fn ($e) => $e->item->is($fixedAssetItemA));
        Event::assertDispatched(FixedAssetItemApproved::class, fn ($e) => $e->item->is($fixedAssetItemB));
        Event::assertNotDispatched(FixedAssetItemApproved::class, fn ($e) => $e->item->is($regularItem));
    }

    #[Test]
    public function does_not_dispatch_event_when_no_fixed_asset_items(): void {
        Event::fake([FixedAssetItemApproved::class]);

        $warehouse   = WarehouseFactory::new()->create();
        $regularItem = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $poItem      = $this->makePoItem($regularItem, 2, $warehouse->id);
        $invoice     = $this->makeInvoice($poItem->purchase_order_id);

        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => 2,
            'rate'                   => 1000,
        ]);

        $this->service->onApproved($invoice);

        Event::assertNotDispatched(FixedAssetItemApproved::class);
    }
}
