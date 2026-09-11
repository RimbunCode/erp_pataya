<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
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
 * Requirement 2.4 (spec event-listener-migration-phase-3, Task 3.2): audit
 * query yg sort/filter created_at pada general_ledgers/stock_ledger_entries,
 * ganti ke transaction_date. PurchaseInvoiceService::updatePendingSLEs() FIFO
 * allocation dulu orderBy('created_at') -- salah kalau SLE dibuat/backfill
 * dengan urutan created_at berbeda dari urutan transaksi sebenarnya
 * (transaction_date). Test ini bikin SLE dgn created_at & transaction_date
 * SENGAJA terbalik urutannya untuk membuktikan FIFO ikut transaction_date.
 */
class PurchaseInvoicePendingSlesFifoOrderTest extends TestCase {
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
            PurchaseReceipt::class,
            PurchaseInvoice::class,
            StockLedgerEntry::class,
        ] as $model) {
            $model::initPermissions();
        }

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

    #[Test]
    public function fifo_allocation_follows_transaction_date_not_created_at(): void {
        // GL posting (PostPurchaseInvoiceGeneralLedger) butuh Account stock/SRNB
        // terpisah yg di luar scope fix FIFO ini -- fake event-nya saja supaya
        // listener itu tidak jalan, tanpa mempengaruhi assertion FIFO di bawah.
        Event::fake([PurchaseInvoiceGeneralLedgerPostingRequested::class]);

        $warehouse = WarehouseFactory::new()->create();
        $item      = ItemFactory::new()->create();
        $variant   = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        $unit = Unit::create([
            'code'              => 'PCS-' . fake()->unique()->numerify('####'),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $variant->update(['default_unit_id' => $unit->id]);

        $supplier = SupplierFactory::new()->create();
        $this->actingAs($this->testUser);
        $po = $this->withoutModelEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'quantity'            => 20,
            'rate'                => 1000,
            'target_warehouse_id' => $warehouse->id,
            // ALUR-1 (updatePendingSLEs) hanya jalan kalau item sudah pernah diterima.
            'received_quantity' => 20,
        ]);

        $receipt = $this->withoutModelEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $po->id,
            'created_by_id'     => $this->testUser->id,
        ]));

        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $receipt->id,
        ]);

        // whereHasMorph('referenceable', ...)->whereHas('items', ...) di
        // updatePendingSLEs() butuh PurchaseReceiptItem nyata yg nunjuk ke
        // poItem yg sama -- bukan cuma header PurchaseReceipt.
        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => 20,
            'target_warehouse_id'    => $warehouse->id,
        ]);

        // SLE "lama" secara transaksi (transaction_date lebih awal) tapi
        // BARU dibuat di sistem (created_at lebih akhir) -- kebalik sengaja.
        $sleTransactedFirst = StockLedgerEntry::create([
            'referenceable_type'         => PurchaseReceipt::class,
            'referenceable_id'           => $receipt->id,
            'item_id'                    => $variant->id,
            'warehouse_id'               => $warehouse->id,
            'item_unit_id'               => $itemUnit->id,
            'conversion_factor'          => 1,
            'quantity_change'            => 10,
            'quantity_after_transaction' => 10,
            'is_valuated'                => false,
            'transaction_date'           => now()->subDays(10),
        ]);
        $sleTransactedFirst->forceFill(['created_at' => now()])->save();

        // SLE "baru" secara transaksi (transaction_date lebih akhir) tapi
        // LEBIH DULU dibuat di sistem (created_at lebih awal).
        $sleTransactedSecond = StockLedgerEntry::create([
            'referenceable_type'         => PurchaseReceipt::class,
            'referenceable_id'           => $receipt->id,
            'item_id'                    => $variant->id,
            'warehouse_id'               => $warehouse->id,
            'item_unit_id'               => $itemUnit->id,
            'conversion_factor'          => 1,
            'quantity_change'            => 10,
            'quantity_after_transaction' => 20,
            'is_valuated'                => false,
            'transaction_date'           => now()->subDays(1),
        ]);
        $sleTransactedSecond->forceFill(['created_at' => now()->subDays(20)])->save();

        $invoice = $this->withoutModelEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $po->id,
            'credit_account_id'       => $this->creditAccount->id,
            'expanse_head_account_id' => $this->expenseAccount->id,
            'created_by_id'           => $this->testUser->id,
        ]));

        // Invoice qty pas 10 -- cuma cukup melunasi SATU SLE, membuktikan
        // yg mana yg "menang" duluan di FIFO.
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => 10,
            'rate'                   => 1500,
        ]);

        $this->service->onApproved($invoice);

        $this->assertTrue(
            $sleTransactedFirst->fresh()->is_valuated,
            'SLE dengan transaction_date lebih awal harus divaluasi duluan (FIFO ikut transaction_date).',
        );
        $this->assertFalse(
            $sleTransactedSecond->fresh()->is_valuated,
            'SLE dengan transaction_date lebih akhir belum boleh divaluasi -- qty invoice cuma cukup utk SLE pertama.',
        );
    }

    #[Test]
    public function over_billed_qty_creates_pending_sle_with_transaction_date(): void {
        // Regresi: StockLedgerEntry::create() untuk sisa qty over-bill
        // (remainingQty > 0) tidak mengisi transaction_date (NOT NULL),
        // menyebabkan 500 "Field 'transaction_date' doesn't have a default
        // value" saat submit Purchase Invoice dengan qty > qty pending SLE.
        Event::fake([PurchaseInvoiceGeneralLedgerPostingRequested::class]);

        $warehouse = WarehouseFactory::new()->create();
        $item      = ItemFactory::new()->create();
        $variant   = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        $unit = Unit::create([
            'code'              => 'PCS-' . fake()->unique()->numerify('####'),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $variant->update(['default_unit_id' => $unit->id]);

        $supplier = SupplierFactory::new()->create();
        $this->actingAs($this->testUser);
        $po = $this->withoutModelEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'quantity'            => 10,
            'rate'                => 1000,
            'target_warehouse_id' => $warehouse->id,
            'received_quantity'   => 10,
        ]);

        $receipt = $this->withoutModelEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $po->id,
            'created_by_id'     => $this->testUser->id,
        ]));

        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $receipt->id,
        ]);

        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => 10,
            'target_warehouse_id'    => $warehouse->id,
        ]);

        // Pending SLE cuma qty 10, invoice akan minta 15 -- sisa 5 over-bill.
        StockLedgerEntry::create([
            'referenceable_type'         => PurchaseReceipt::class,
            'referenceable_id'           => $receipt->id,
            'item_id'                    => $variant->id,
            'warehouse_id'               => $warehouse->id,
            'item_unit_id'               => $itemUnit->id,
            'conversion_factor'          => 1,
            'quantity_change'            => 10,
            'quantity_after_transaction' => 10,
            'is_valuated'                => false,
            'transaction_date'           => now()->subDay(),
        ]);

        $invoice = $this->withoutModelEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $po->id,
            'credit_account_id'       => $this->creditAccount->id,
            'expanse_head_account_id' => $this->expenseAccount->id,
            'created_by_id'           => $this->testUser->id,
        ]));

        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => 15,
            'rate'                   => 1500,
        ]);

        $this->service->onApproved($invoice);

        $overBilledSle = StockLedgerEntry::where('referenceable_type', PurchaseInvoice::class)
            ->where('referenceable_id', $invoice->id)
            ->where('is_valuated', false)
            ->first();

        $this->assertNotNull($overBilledSle, 'SLE pending untuk sisa qty over-bill harus dibuat.');
        $this->assertEquals(5, (float) $overBilledSle->quantity_change);
        $this->assertNotNull($overBilledSle->transaction_date, 'transaction_date wajib terisi (kolom NOT NULL).');
    }
}
