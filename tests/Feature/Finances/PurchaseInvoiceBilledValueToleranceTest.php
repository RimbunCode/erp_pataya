<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged;
use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Models\Core\Currency;
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
use App\Models\Purchase\PurchaseSetting;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Finances\InvoiceBilledValueResolver;
use App\Services\Finances\PurchaseInvoiceService;
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
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec module-defaults-and-controls, Requirement 7.2/7.5: toleransi nilai penagihan berlebih
 * Purchase Invoice memakai nilai neto yang benar-benar sudah ditagih (invoice approved pada
 * baris PO yang sama), dengan basis yang sama saat simpan dan saat approve.
 */
class PurchaseInvoiceBilledValueToleranceTest extends TestCase {
    use RefreshDatabase;

    private PurchaseInvoiceService $service;
    private User $user;
    private Warehouse $warehouse;
    private Supplier $supplier;
    private string $taxId;
    private PurchaseOrder $po;
    private PurchaseOrderItem $poItem;
    private ItemVariant $variant;
    private ItemUnit $itemUnit;
    private Account $credit;
    private Account $expense;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new PurchaseInvoiceService;

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
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseInvoice::class] as $model) {
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

        Event::fake([
            FixedAssetItemApproved::class,
            PurchaseInvoiceGeneralLedgerPostingRequested::class,
            PurchaseOrderBillStatusRecalculationRequested::class,
            PurchaseOrderItemBillingChanged::class,
        ]);

        $this->user      = User::factory()->create();
        $this->supplier  = SupplierFactory::new()->create();
        $this->taxId     = TaxFactory::new()->create()->id;
        $this->warehouse = WarehouseFactory::new()->create();
        $this->actingAs($this->user);

        $item           = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $this->variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit           = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $this->itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $this->variant->update(['default_unit_id' => $unit->id]);
        $this->credit  = Account::create(['account_name' => 'AP', 'account_number' => '2000', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $this->expense = Account::create(['account_name' => 'Exp', 'account_number' => '5000', 'root_type' => 'expense', 'report_type' => 'profit_and_loss']);

        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $this->supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
        // PO 10 x 100 = 1000.
        $this->poItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $this->variant->id,
            'quantity'            => 10,
            'rate'                => 100,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $this->itemUnit->id,
        ]);
    }

    /**
     * Invoice pada PO Item dengan status tertentu. `billed_quantity` PO Item dinaikkan
     * manual karena event billing di-fake (dalam alur nyata dinaikkan listener saat approve).
     *
     * @param  array<int, FormStatus>  $status
     */
    private function seedInvoice(float $quantity, float $rate, array $status = [FormStatus::UNPAID], array $itemOver = [], array $invoiceOver = []): PurchaseInvoiceItem {
        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create(array_merge([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $this->credit->id,
            'expanse_head_account_id' => $this->expense->id,
            'created_by_id'           => $this->user->id,
        ], $invoiceOver)));
        $invoice->forceFill(['submitted_at' => now(), 'status' => $status])->save();

        return PurchaseInvoiceItem::create(array_merge([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $this->poItem->id,
            'item_id'                => $this->variant->id,
            'item_unit_id'           => $this->itemUnit->id,
            'conversion_factor'      => 1,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ], $itemOver));
    }

    private function markBilled(float $quantity): void {
        $this->poItem->update(['billed_quantity' => $quantity]);
    }

    private function row(float $quantity, float $rate, array $over = []): array {
        return array_merge([
            'id'                  => (string) Str::ulid(),
            'purchase_order_item' => ['id' => $this->poItem->id],
            'quantity'            => $quantity,
            'rate'                => $rate,
            'unit'                => ['id' => $this->itemUnit->id],
            'tax'                 => ['id' => $this->taxId],
        ], $over);
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

    private function approve(float $quantity, float $rate, array $itemOver = [], array $invoiceOver = []): PurchaseInvoice {
        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create(array_merge([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $this->credit->id,
            'expanse_head_account_id' => $this->expense->id,
            'created_by_id'           => $this->user->id,
        ], $invoiceOver)));
        PurchaseInvoiceItem::create(array_merge([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $this->poItem->id,
            'item_id'                => $this->variant->id,
            'item_unit_id'           => $this->itemUnit->id,
            'conversion_factor'      => 1,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ], $itemOver));

        return $this->service->onApproved($invoice);
    }

    // --- simpan ---------------------------------------------------------------

    #[Test]
    public function request_counts_value_already_billed_by_approved_invoices_not_billed_quantity_times_source_rate(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        // Invoice A: 5 @ 200 = 1000 (menghabiskan nilai PO), billed_quantity 5.
        $this->seedInvoice(5, 200);
        $this->markBilled(5);

        // Invoice B: 5 @ 100 = 500. Kuantitas masih muat (5 + 5 <= 10), tetapi nilai total 1500 > 1000.
        $validator = $this->validate([$this->row(5, 100)]);

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('items.0.rate', $errors);
        $this->assertArrayNotHasKey('items.0.quantity', $errors);
    }

    #[Test]
    public function request_allows_the_value_still_left_after_approved_invoices(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(5, 100);
        $this->markBilled(5);

        $this->assertFalse($this->validate([$this->row(5, 100)])->fails());
        $this->assertTrue($this->validate([$this->row(5, 101)])->fails());
    }

    #[Test]
    public function request_ignores_draft_and_canceled_invoices_when_accumulating_billed_value(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(5, 200, [FormStatus::DRAFT]);
        $this->seedInvoice(5, 200, [FormStatus::CANCELED]);

        $this->assertFalse($this->validate([$this->row(10, 100)])->fails());
    }

    #[Test]
    public function request_nets_return_invoices_against_billed_value(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $original = $this->seedInvoice(10, 100);
        $this->seedInvoice(4, 100, [FormStatus::RETURNED], [], ['return_against_id' => $original->purchase_invoice_id]);
        $this->markBilled(6);

        $this->assertFalse($this->validate([$this->row(4, 100)])->fails(), 'Retur 400 membebaskan kembali nilai tagihan.');
        $this->assertTrue($this->validate([$this->row(4, 101)])->fails());
    }

    #[Test]
    public function request_value_error_message_states_the_remaining_value(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(4, 100);
        $this->markBilled(4);

        $validator = $this->validate([$this->row(6, 150)]);

        $message = $validator->errors()->first('items.0.rate');
        $this->assertStringContainsString('600', $message, 'Pesan harus menyebut sisa nilai (1000 - 400).');
        $this->assertStringNotContainsString(':remaining', $message);
    }

    #[Test]
    public function request_uses_net_value_after_header_discount_for_requested_and_source(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);

        // Neto 10 x 110 - 100 = 1000: tepat sama dengan nilai PO.
        $withinNet = $this->validate([$this->row(10, 110)], ['discount_on' => 'net_total', 'discount_rate' => 0, 'discount_amount' => 100]);
        $this->assertFalse($withinNet->fails(), json_encode($withinNet->errors()->toArray()));

        // Neto 10 x 111 - 100 = 1010: melewati batas walau bruto-diskon seolah wajar.
        $overNet = $this->validate([$this->row(10, 111)], ['discount_on' => 'net_total', 'discount_rate' => 0, 'discount_amount' => 100]);
        $this->assertArrayHasKey('items.0.rate', $overNet->errors()->toArray());

        // Sumber ber-diskon: nilai neto PO 900, jadi tagihan bruto 1000 tanpa diskon melebihi batas.
        $this->poItem->update(['discount_amount' => 100]);
        $this->assertTrue($this->validate([$this->row(10, 100)])->fails());
        $this->assertFalse($this->validate([$this->row(10, 90)])->fails());
    }

    #[Test]
    public function request_error_is_reported_on_the_offending_row_index(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $otherPoItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $this->variant->id,
            'quantity'            => 10,
            'rate'                => 100,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $this->itemUnit->id,
        ]);

        $validator = $this->validate([
            $this->row(1, 100, ['purchase_order_item' => ['id' => $otherPoItem->id]]),
            $this->row(10, 150),
        ]);

        $this->assertArrayHasKey('items.1.rate', $validator->errors()->toArray());
    }

    #[Test]
    public function request_with_null_tolerance_stays_neutral(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => null]);
        $this->seedInvoice(5, 200);
        $this->markBilled(5);

        $this->assertFalse($this->validate([$this->row(5, 500)])->fails());
    }

    // --- approve --------------------------------------------------------------

    #[Test]
    public function approval_rejects_second_invoice_that_pushes_cumulative_value_over_the_limit(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);

        $this->approve(5, 200);
        $this->markBilled(5);

        try {
            $this->approve(5, 100);
            $this->fail('Ekspektasi approval menolak nilai kumulatif 1500 > 1000.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString(': 0)', (string) ($exception->errors()['items'][0] ?? ''));
        }
        $this->assertSame(1, PurchaseInvoice::whereJsonContains('status', FormStatus::UNPAID->value)->count());
    }

    #[Test]
    public function approval_value_error_message_states_the_remaining_value(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->approve(4, 100);
        $this->markBilled(4);

        try {
            $this->approve(6, 150);
            $this->fail('Ekspektasi ValidationException.');
        } catch (ValidationException $exception) {
            $message = (string) ($exception->errors()['items'][0] ?? '');
            $this->assertStringContainsString('600', $message);
            $this->assertStringNotContainsString(':remaining', $message);
        }
    }

    #[Test]
    public function approval_allows_the_remaining_value_and_uses_the_same_net_basis_as_save(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->approve(5, 100);
        $this->markBilled(5);

        // Sisa 500: 5 @ 110 dengan diskon baris 50 = neto 500 -> lolos.
        $invoice = $this->approve(5, 110, ['discount_amount' => 50]);

        $this->assertTrue($invoice->fresh()->status === [FormStatus::UNPAID] || \in_array(FormStatus::UNPAID, (array) $invoice->fresh()->status, true));
    }

    #[Test]
    public function approval_with_null_tolerance_does_not_limit_value(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => null]);
        $this->approve(5, 200);
        $this->markBilled(5);

        $invoice = $this->approve(5, 500);

        $this->assertNotNull($invoice);
    }

    // --- mata uang dokumen (B2) ---------------------------------------------------

    private function usePurchaseOrderInUsd(float $exchangeRate = 15000): void {
        Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar']);
        Currency::firstOrCreate(['code' => 'EUR'], ['name' => 'Euro']);
        $this->po->forceFill(['currency_code' => 'USD', 'exchange_rate' => $exchangeRate])->save();
    }

    /** @return array<string, mixed> */
    private function usd(float $exchangeRate): array {
        return ['currency' => ['code' => 'USD'], 'exchange_rate' => $exchangeRate];
    }

    #[Test]
    public function same_currency_with_a_different_exchange_rate_is_not_a_rate_change_or_over_billing(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        $validator = $this->validate([$this->row(10, 100)], $this->usd(15500));

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function same_currency_real_rate_increase_is_still_detected_and_over_billed(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        $errors = $this->validate([$this->row(10, 101)], $this->usd(15500))->errors()->toArray();

        $this->assertArrayHasKey('items.0.rate', $errors);
        $this->assertCount(2, $errors['items.0.rate'], 'Perubahan tarif dan nilai melebihi batas.');
    }

    #[Test]
    public function different_currency_keeps_the_base_currency_conversion(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        // Tarif sama 100 tetapi EUR kurs 17000: dalam mata uang dasar 1.700.000 vs 1.500.000.
        $validator = $this->validate([$this->row(10, 100)], ['currency' => ['code' => 'EUR'], 'exchange_rate' => 17000]);
        $this->assertArrayHasKey('items.0.rate', $validator->errors()->toArray());

        // Setara dalam mata uang dasar (EUR 88,2353 x 17000 = 1.500.000): tidak berubah.
        $equivalent = $this->validate([$this->row(10, 1500000 / 17000)], ['currency' => ['code' => 'EUR'], 'exchange_rate' => 17000]);
        $this->assertFalse($equivalent->fails(), json_encode($equivalent->errors()->toArray()));
    }

    #[Test]
    public function same_currency_accumulates_billed_value_in_the_source_currency(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        // Invoice A: USD 5 x 100 = 500 pada kurs 15200.
        $this->seedInvoice(5, 100, [FormStatus::UNPAID], [], ['currency_code' => 'USD', 'exchange_rate' => 15200]);
        $this->markBilled(5);

        $this->assertFalse($this->validate([$this->row(5, 100)], $this->usd(15500))->fails());
        $this->assertTrue($this->validate([$this->row(5, 101)], $this->usd(15500))->fails());
    }

    #[Test]
    public function approval_same_currency_with_a_different_exchange_rate_passes_tolerance_and_rate_change(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        $invoice = $this->approve(10, 100, [], ['currency_code' => 'USD', 'exchange_rate' => 15500]);

        $this->assertNotNull($invoice);
    }

    #[Test]
    public function approval_same_currency_real_increase_is_rejected(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'none']);

        $this->expectException(ValidationException::class);
        $this->approve(10, 101, [], ['currency_code' => 'USD', 'exchange_rate' => 15500]);
    }

    #[Test]
    public function approval_different_currency_still_uses_base_currency(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);

        $this->expectException(ValidationException::class);
        $this->approve(10, 100, [], ['currency_code' => 'EUR', 'exchange_rate' => 17000]);
    }

    #[Test]
    public function null_tolerance_and_none_action_stay_neutral_with_different_exchange_rates(): void {
        $this->usePurchaseOrderInUsd(15000);
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => null, 'rate_change_action' => 'none']);

        $this->assertFalse($this->validate([$this->row(10, 500)], $this->usd(15500))->fails());
    }

    #[Test]
    public function approval_reads_billed_value_with_a_lock_but_save_does_not(): void {
        PurchaseSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $lockFlags = [];
        $this->partialMock(InvoiceBilledValueResolver::class, function ($mock) use (&$lockFlags): void {
            $mock->shouldReceive('billedValues')->andReturnUsing(function (...$args) use (&$lockFlags): array {
                $lockFlags[] = $args[5] ?? false;

                return [];
            });
        });

        // Hook validasi baru berjalan saat fails() dipanggil.
        $this->validate([$this->row(1, 100)])->fails();
        $this->approve(1, 100);

        $this->assertSame([false, true], $lockFlags);
    }
}
