<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Models\Core\Currency;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Core\Connection\RelationPanelService;
use App\Services\Core\PermissionChecker;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Panel relasi tahap 1 di PurchaseOrder: isi panel PurchaseReceipt dan
 * PurchaseInvoice, empty state dengan aksi, agregat, penjagaan baris draft,
 * dan jumlah query.
 */
class PurchaseOrderRelationPanelTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Supplier $supplier;
    private Warehouse $warehouse;
    private ItemVariant $variant;
    private ItemUnit $itemUnit;
    private Account $credit;
    private Account $expense;
    private PurchaseOrder $po;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        if (! Schema::hasColumns('accounts', ['lft', 'rgt', 'depth'])) {
            Schema::table('accounts', function ($table) {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            });
        }
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class, PurchaseInvoice::class] as $model) {
            $model::initPermissions();
        }
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        CountryFactory::new()->create(['code' => 'IDN']);

        $this->user = User::factory()->create();
        $this->actingAs($this->user);
        $this->supplier  = SupplierFactory::new()->create();
        $this->warehouse = WarehouseFactory::new()->create();

        $item           = ItemFactory::new()->create();
        $this->variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit           = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $this->itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $this->credit   = Account::create(['account_name' => 'AP', 'account_number' => '2000', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $this->expense  = Account::create(['account_name' => 'Exp', 'account_number' => '5000', 'root_type' => 'expense', 'report_type' => 'profit_and_loss']);

        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $this->supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));

        // Read dan create tanpa only_creator: panel menampilkan semua baris yang lolos penjagaan.
        $grant = [0 => [['permissions' => ['read' => true, 'create' => true]]]];
        app()->instance(PermissionChecker::class, new PermissionChecker([
            PurchaseReceipt::class => $grant,
            PurchaseInvoice::class => $grant,
        ]));
    }

    private function submittedReceipt(float $quantity): PurchaseReceipt {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));
        $receipt->forceFill(['submitted_at' => now(), 'status' => [FormStatus::RECEIVED]])->save();

        $this->addItem($receipt, $quantity);
        $this->connect($receipt);

        return $receipt;
    }

    private function draftReceipt(User $creator): PurchaseReceipt {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $creator->id,
        ]));
        $this->connect($receipt);

        return $receipt;
    }

    private function addItem(PurchaseReceipt $receipt, float $quantity): void {
        PurchaseReceiptItem::create([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $this->variant->id,
            'item_unit_id'        => $this->itemUnit->id,
            'quantity'            => $quantity,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
    }

    private function invoice(float $amount): PurchaseInvoice {
        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $this->credit->id,
            'expanse_head_account_id' => $this->expense->id,
            'created_by_id'           => $this->user->id,
        ]));
        $invoice->forceFill(['amount' => $amount])->save();
        $this->connect($invoice);

        return $invoice;
    }

    private function connect(BaseModel $reference): void {
        ModelConnection::createConnection([
            'model'     => $this->po,
            'reference' => $reference,
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function panels(): array {
        return (new RelationPanelService)->build($this->po);
    }

    /** @return array<string, mixed> */
    private function panelFor(array $panels, string $referenceType): array {
        $matches = array_values(array_filter(
            $panels,
            fn (array $panel): bool => $panel['reference_type'] === $referenceType,
        ));
        $this->assertCount(1, $matches);

        return $matches[0];
    }

    /**
     * Item PO dengan received/billed yang dipaksa, karena kolom sisa adalah
     * kolom generated dan harus dibaca dari DB, bukan dari nilai PHP.
     */
    private function purchaseOrderItem(float $quantity, float $received, float $billed = 0): PurchaseOrderItem {
        $item = PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $this->variant->id,
            'quantity'            => $quantity,
            'rate'                => 1000,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
        DB::table('purchase_order_items')->where('id', $item->id)->update([
            'received_quantity' => $received,
            'billed_quantity'   => $billed,
        ]);

        return $item;
    }

    private function countQueries(callable $callback): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $callback();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    #[Test]
    public function receipt_panel_lists_submitted_receipts_with_summed_quantity(): void {
        $this->submittedReceipt(3);
        $this->submittedReceipt(5);

        $panel = $this->panelFor($this->panels(), PurchaseReceipt::class);

        $this->assertFalse($panel['is_empty']);
        $this->assertCount(2, $panel['rows']);
        $this->assertEquals(['total_quantity' => 8], $panel['totals']);
        $this->assertSame('purchase.purchaseReceipt.panel.title', $panel['title']);
    }

    #[Test]
    public function invoice_panel_without_invoice_is_empty_and_offers_create_action(): void {
        $panel = $this->panelFor($this->panels(), PurchaseInvoice::class);

        $this->assertTrue($panel['is_empty']);
        $this->assertSame([], $panel['rows']);
        $this->assertSame('purchase.purchaseOrder.actions.create_purchase_invoice', $panel['action']['label']);
        // Rute purchaseInvoices.create membawa ref sebagai segmen path, sama seperti dropdown Actions.
        $this->assertStringEndsWith(
            '/purchaseInvoices/create/purchaseOrder/' . $this->po->id,
            (string) parse_url($panel['action']['url'], PHP_URL_PATH),
        );
    }

    #[Test]
    public function invoice_panel_sums_invoice_amounts(): void {
        $this->invoice(1500);
        $this->invoice(2500);

        $panel = $this->panelFor($this->panels(), PurchaseInvoice::class);

        $this->assertFalse($panel['is_empty']);
        $this->assertCount(2, $panel['rows']);
        $this->assertEquals(['total' => 4000], $panel['totals']);
    }

    /**
     * currency_code diisi per-invoice saat create (PurchaseInvoiceService),
     * bukan diwarisi dari PO, jadi satu PO bisa punya invoice beda mata uang.
     * Baris menampilkan nilai asli dokumen; baris total memakai nilai mata uang
     * dasar lewat aggregate_key, karena menjumlahkan nilai asal menghasilkan
     * angka yang tidak sebanding.
     */
    #[Test]
    public function invoice_total_sums_base_currency_when_invoices_use_different_currencies(): void {
        $idr = $this->invoice(1000);

        Currency::firstOrCreate(['code' => 'USD'], [
            'name'          => 'US Dollar',
            'symbol'        => '$',
            'number_format' => '#,###.##',
        ]);

        $usd = $this->invoice(100);
        $usd->forceFill([
            'currency_code' => 'USD',
            'exchange_rate' => 16_000,
        ])->save();
        $usd->refresh();

        $panel = $this->panelFor($this->panels(), PurchaseInvoice::class);

        $this->assertEqualsCanonicalizing(
            [1000.0, 100.0],
            collect($panel['rows'])->pluck('total')->map(fn ($value) => (float) $value)->all(),
        );

        $this->assertEqualsWithDelta(
            $idr->refresh()->amount_base_currency + $usd->amount_base_currency,
            $panel['totals']['total'],
            0.01,
        );
        // Tanpa aggregate_key totalnya 1100, hasil menjumlahkan IDR dengan USD.
        $this->assertGreaterThan(1_000_000, $panel['totals']['total']);
    }

    /**
     * Draft milik user lain tidak boleh bocor ke panel, draft milik sendiri tetap tampil.
     */
    #[Test]
    public function draft_receipt_of_another_user_is_hidden_from_the_panel(): void {
        $otherUser = User::factory()->create();

        $this->submittedReceipt(2);
        $this->draftReceipt($otherUser);
        $own = $this->draftReceipt($this->user);

        $panel = $this->panelFor($this->panels(), PurchaseReceipt::class);

        $this->assertCount(2, $panel['rows']);
        $this->assertContains($own->id, array_column($panel['rows'], 'id'));
    }

    #[Test]
    public function query_count_does_not_grow_with_the_number_of_receipts(): void {
        $this->submittedReceipt(1);
        $this->submittedReceipt(2);

        $service = new RelationPanelService;
        // Panggilan pertama memuat item PO dan introspeksi schema sekali. Ukur setelah pemanasan.
        $service->build($this->po);
        $fewRows = $this->countQueries(fn () => $service->build($this->po));

        foreach ([3, 4, 5, 6] as $quantity) {
            $this->submittedReceipt($quantity);
        }

        $manyRows = $this->countQueries(fn () => $service->build($this->po));

        $this->assertGreaterThan(0, $fewRows);
        $this->assertSame($fewRows, $manyRows);
    }

    #[Test]
    public function receipt_row_expands_to_its_items_with_readable_names(): void {
        $this->submittedReceipt(3);

        $panel = $this->panelFor($this->panels(), PurchaseReceipt::class);

        $this->assertSame(['item', 'quantity'], array_column($panel['detail_columns'], 'key'));
        $this->assertSame(
            [['item' => $this->variant->item_name, 'quantity' => 3.0]],
            $panel['rows'][0]['detail_rows'],
        );
    }

    /**
     * Remainder hanya memuat item yang masih punya sisa, dan blok hilang sepenuhnya
     * ketika semua item sudah diterima.
     */
    #[Test]
    public function receipt_remainder_lists_unreceived_items_and_disappears_when_complete(): void {
        $this->purchaseOrderItem(10, 10);
        $partial = $this->purchaseOrderItem(10, 4);

        $panel = $this->panelFor($this->panels(), PurchaseReceipt::class);
        $this->assertSame(
            [['item' => $this->variant->item_name, 'remaining' => 6.0]],
            $panel['remainder']['rows'],
        );

        DB::table('purchase_order_items')->where('id', $partial->id)->update(['received_quantity' => 10]);
        $this->po = $this->po->fresh();

        $panel = $this->panelFor($this->panels(), PurchaseReceipt::class);
        $this->assertArrayNotHasKey('remainder', $panel);
    }

    #[Test]
    public function invoice_remainder_lists_items_not_yet_billed(): void {
        $this->purchaseOrderItem(10, 10, 4);
        $this->purchaseOrderItem(5, 5, 5);

        $panel = $this->panelFor($this->panels(), PurchaseInvoice::class);

        $this->assertSame(
            [['item' => $this->variant->item_name, 'remaining' => 6.0]],
            $panel['remainder']['rows'],
        );
    }
}
