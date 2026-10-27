<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\PurchaseReceiptOffPoItem;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec purchase-invoice-off-po-items, Requirement 1-2: validasi tiga jenis
 * baris invoice (normal, baris receipt di luar PO, item bebas).
 */
class PurchaseInvoiceRequestOffPoTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Supplier $supplier;
    private Warehouse $warehouse;
    private PurchaseOrder $po;
    private PurchaseOrderItem $poItem;
    private ItemVariant $poVariant;
    private ItemVariant $otherVariant;
    private ItemUnit $itemUnit;
    private string $taxId;
    private Account $credit;
    private Account $expense;

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

        $this->user      = User::factory()->create();
        $this->supplier  = SupplierFactory::new()->create();
        $this->warehouse = WarehouseFactory::new()->create();
        $this->actingAs($this->user);

        $item               = ItemFactory::new()->create();
        $this->poVariant    = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $this->otherVariant = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit               = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $this->itemUnit     = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $this->credit       = Account::create(['account_name' => 'AP', 'account_number' => '2000', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $this->expense      = Account::create(['account_name' => 'Exp', 'account_number' => '5000', 'root_type' => 'expense', 'report_type' => 'profit_and_loss']);

        $this->taxId = TaxFactory::new()->create()->id;

        $this->po     = $this->makePo();
        $this->poItem = $this->makePoItem($this->po, $this->poVariant);
    }

    private function makePo(): PurchaseOrder {
        return BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $this->supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
    }

    private function makePoItem(PurchaseOrder $po, ItemVariant $variant): PurchaseOrderItem {
        return PurchaseOrderItem::create([
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'quantity'            => 10,
            'rate'                => 1000,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
    }

    /** Baris receipt di luar PO pada PO tertentu; $approved menentukan status receipt. */
    private function makeReceiptRow(PurchaseOrder $po, array $rowOver = [], bool $approved = true): PurchaseReceiptItem {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $po->id,
            'created_by_id'     => $this->user->id,
        ]));
        if ($approved) {
            $receipt->forceFill(['submitted_at' => now(), 'status' => [FormStatus::RECEIVED]])->save();
        }

        return PurchaseReceiptItem::create(array_merge([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $this->otherVariant->id,
            'item_unit_id'        => $this->itemUnit->id,
            'quantity'            => 5,
            'target_warehouse_id' => $this->warehouse->id,
        ], $rowOver));
    }

    #[Test]
    public function rejects_normal_row_without_tax(): void {
        $validator = $this->validate([
            $this->row(['id' => (string) Str::ulid(), 'item' => ['id' => $this->poVariant->id], 'purchase_order_item' => ['id' => $this->poItem->id]], ['tax' => null]),
        ]);

        $this->assertErrorOn($validator, 'items.0.tax.id');
    }

    private function row(array $source, array $over = []): array {
        // Pajak wajib per baris (PurchaseInvoiceRequest 'items.*.tax.id' => required).
        return array_merge([
            'id'       => (string) Str::ulid(),
            'quantity' => 5,
            'rate'     => 1500,
            'unit'     => ['id' => $this->itemUnit->id],
            'tax'      => ['id' => $this->taxId],
        ], $source, $over);
    }

    private function validate(array $items, array $extra = []): Validator {
        $data = array_merge([
            'date'                 => now()->toDateString(),
            'purchase_order'       => ['id' => $this->po->id],
            'expense_head_account' => ['id' => $this->expense->id],
            'credit_account'       => ['id' => $this->credit->id],
            'supplier'             => ['id' => $this->supplier->id],
            'items'                => $items,
        ], $extra);

        $request   = PurchaseInvoiceRequest::create('/', 'POST', $data);
        $validator = ValidatorFacade::make($data, $request->rules());
        $request->setContainer(app());
        $request->withValidator($validator);

        return $validator;
    }

    private function assertErrorOn(Validator $validator, string $key): void {
        $this->assertTrue($validator->fails(), 'Diharapkan validasi gagal.');
        $this->assertArrayHasKey($key, $validator->errors()->toArray(), json_encode($validator->errors()->toArray()));
    }

    private function assertValid(Validator $validator): void {
        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    // --- model --------------------------------------------------------------

    #[Test]
    public function invoice_item_stores_receipt_item_link_and_receipt_item_has_billed_quantity(): void {
        $receiptRow = $this->makeReceiptRow($this->po);
        $invoice    = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $this->credit->id,
            'expanse_head_account_id' => $this->expense->id,
            'created_by_id'           => $this->user->id,
        ]));
        $invoiceItem = PurchaseInvoiceItem::create([
            'purchase_invoice_id'      => $invoice->id,
            'purchase_receipt_item_id' => $receiptRow->id,
            'item_id'                  => $receiptRow->item_id,
            'quantity'                 => 2,
            'rate'                     => 100,
        ]);

        $this->assertTrue($invoiceItem->fresh()->purchaseReceiptItem->is($receiptRow));
        $this->assertInstanceOf(
            PurchaseReceiptOffPoItem::class,
            $invoiceItem->fresh()->purchaseReceiptItem,
            'thisModel harus cocok sub model dropdown agar LinkModel tak mengosongkan baris',
        );
        $this->assertSame(0.0, $receiptRow->fresh()->billed_quantity);
    }

    // --- request: tiga jenis baris -----------------------------------------

    #[Test]
    public function accepts_normal_row_unchanged(): void {
        $this->assertValid($this->validate([$this->row(['purchase_order_item' => ['id' => $this->poItem->id]])]));
    }

    #[Test]
    public function invoice_tolerance_applies_to_po_quantity_and_gross_value_but_receipt_off_po_is_quantity_only(): void {
        $this->poItem->update(['quantity' => 10, 'rate' => 1000]);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 10]);

        $withinLimit = $this->validate([$this->row(['purchase_order_item' => ['id' => $this->poItem->id]], ['quantity' => 11, 'rate' => 1000])]);
        $this->assertValid($withinLimit);

        $overValue = $this->validate([$this->row(['purchase_order_item' => ['id' => $this->poItem->id]], ['quantity' => 10, 'rate' => 1110])]);
        $this->assertErrorOn($overValue, 'items.0.rate');

        $receiptRow     = $this->makeReceiptRow($this->po);
        $receiptInvoice = $this->validate([$this->row(['purchase_receipt_item' => ['id' => $receiptRow->id]], ['quantity' => 5.5, 'rate' => 1500])]);
        $this->assertValid($receiptInvoice);
    }

    #[Test]
    public function rate_change_stop_rejects_purchase_invoice_rate_different_from_purchase_order(): void {
        $this->poItem->update(['rate' => 1000]);
        PurchaseSetting::current()->update(['rate_change_action' => 'stop']);

        $validator = $this->validate([
            $this->row(['purchase_order_item' => ['id' => $this->poItem->id]], ['quantity' => 1, 'rate' => 1010]),
        ]);

        $this->assertErrorOn($validator, 'items.0.rate');
    }

    #[Test]
    public function rate_change_warn_allows_purchase_invoice_and_flashes_warning(): void {
        $this->poItem->update(['rate' => 1000]);
        PurchaseSetting::current()->update(['rate_change_action' => 'warn']);
        $data = [
            'date'                 => now()->toDateString(),
            'purchase_order'       => ['id' => $this->po->id],
            'expense_head_account' => ['id' => $this->expense->id],
            'credit_account'       => ['id' => $this->credit->id],
            'supplier'             => ['id' => $this->supplier->id],
            'items'                => [$this->row(['purchase_order_item' => ['id' => $this->poItem->id]], ['quantity' => 1, 'rate' => 1010])],
        ];
        $request = PurchaseInvoiceRequest::create('/', 'POST', $data);
        $request->setContainer(app());
        $request->setLaravelSession(app('session')->driver());
        $validator = ValidatorFacade::make($data, $request->rules());
        $request->withValidator($validator);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
        $this->assertNotEmpty($request->session()->get('priceWarnings'));
    }

    #[Test]
    public function accepts_receipt_row_outside_po(): void {
        $receiptRow = $this->makeReceiptRow($this->po);

        $this->assertValid($this->validate([$this->row(['purchase_receipt_item' => ['id' => $receiptRow->id]])]));
    }

    #[Test]
    public function accepts_free_item_row(): void {
        $this->assertValid($this->validate([$this->row(['item' => ['id' => $this->otherVariant->id]])]));
    }

    #[Test]
    public function rejects_row_without_any_source(): void {
        $this->assertErrorOn($this->validate([$this->row([])]), 'items.0.purchase_order_item.id');
    }

    #[Test]
    public function po_item_takes_precedence_over_stray_item_key(): void {
        // Baris retur/relasi dapat membawa `item` bersama `purchase_order_item`: PO Item menang.
        $validator = $this->validate([$this->row([
            'purchase_order_item' => ['id' => $this->poItem->id],
            'item'                => ['id' => $this->poVariant->id],
        ])]);

        $this->assertValid($validator);
    }

    #[Test]
    public function rejects_unknown_receipt_item_and_unknown_item(): void {
        $this->assertErrorOn($this->validate([$this->row(['purchase_receipt_item' => ['id' => (string) Str::ulid()]])]), 'items.0.purchase_receipt_item.id');
        $this->assertErrorOn($this->validate([$this->row(['item' => ['id' => (string) Str::ulid()]])]), 'items.0.item.id');
    }

    // --- baris receipt ------------------------------------------------------

    #[Test]
    public function rejects_receipt_row_from_unapproved_receipt(): void {
        $receiptRow = $this->makeReceiptRow($this->po, approved: false);

        $this->assertErrorOn($this->validate([$this->row(['purchase_receipt_item' => ['id' => $receiptRow->id]])]), 'items.0.purchase_receipt_item.id');
    }

    #[Test]
    public function rejects_receipt_row_from_another_purchase_order(): void {
        $otherPo    = $this->makePo();
        $receiptRow = $this->makeReceiptRow($otherPo);

        $this->assertErrorOn($this->validate([$this->row(['purchase_receipt_item' => ['id' => $receiptRow->id]])]), 'items.0.purchase_receipt_item.id');
    }

    #[Test]
    public function rejects_receipt_row_that_has_po_item_or_replaces_one(): void {
        $normalRow       = $this->makeReceiptRow($this->po, ['purchase_order_item_id' => $this->poItem->id, 'item_id' => $this->poVariant->id]);
        $substitutionRow = $this->makeReceiptRow($this->po, ['replaces_purchase_order_item_id' => $this->poItem->id, 'replaced_quantity' => 2]);

        $this->assertErrorOn($this->validate([$this->row(['purchase_receipt_item' => ['id' => $normalRow->id]])]), 'items.0.purchase_receipt_item.id');
        $this->assertErrorOn($this->validate([$this->row(['purchase_receipt_item' => ['id' => $substitutionRow->id]])]), 'items.0.purchase_receipt_item.id');
    }

    #[Test]
    public function allows_over_billing_of_receipt_row(): void {
        $receiptRow = $this->makeReceiptRow($this->po, ['quantity' => 5]);

        $this->assertValid($this->validate([$this->row(['purchase_receipt_item' => ['id' => $receiptRow->id]], ['quantity' => 50])]));
    }

    // --- item bebas ---------------------------------------------------------

    #[Test]
    public function rejects_free_item_that_is_already_a_po_item_anti_bypass(): void {
        $this->assertErrorOn($this->validate([$this->row(['item' => ['id' => $this->poVariant->id]])]), 'items.0.item.id');
    }

    #[Test]
    public function receipt_and_free_rows_require_a_purchase_order(): void {
        $receiptRow = $this->makeReceiptRow($this->po);

        $withoutPo = ['purchase_order' => ['id' => null]];
        $this->assertErrorOn($this->validate([$this->row(['item' => ['id' => $this->otherVariant->id]])], $withoutPo), 'items.0.purchase_order_item.id');
        $this->assertErrorOn($this->validate([$this->row(['purchase_receipt_item' => ['id' => $receiptRow->id]])], $withoutPo), 'items.0.purchase_order_item.id');
    }

    #[Test]
    public function return_invoices_skip_off_po_rules(): void {
        $original = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $this->credit->id,
            'expanse_head_account_id' => $this->expense->id,
            'created_by_id'           => $this->user->id,
        ]));
        $original->forceFill(['status' => [FormStatus::UNPAID]])->save();
        $source = PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $original->id,
            'item_id'             => $this->poVariant->id,
            'item_unit_id'        => $this->itemUnit->id,
            'quantity'            => 10,
            'rate'                => 1500,
        ]);

        // Item sudah ada di PO: tetap lolos karena ini retur.
        $validator = $this->validate(
            [$this->row(['item' => ['id' => $this->poVariant->id], 'return_against_item_id' => $source->id])],
            ['return_against' => ['id' => $original->id]],
        );

        $this->assertValid($validator);
    }
}
