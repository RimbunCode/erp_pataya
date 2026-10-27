<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Events\Sales\Invoice\SalesOrderItemBillingChanged;
use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesSetting;
use App\Models\User\User;
use App\Services\Finances\InvoiceBilledValueResolver;
use App\Services\Finances\SalesInvoiceService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
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
 * Sales Invoice memakai nilai neto yang benar-benar sudah ditagih (invoice approved pada baris
 * SO yang sama), dengan basis yang sama saat simpan dan saat approve.
 */
class SalesInvoiceBilledValueToleranceTest extends TestCase {
    use RefreshDatabase;

    private string $salesOrderId;
    private string $salesOrderItemId;
    private string $customerId;
    private string $customerBranchId;
    private string $taxId;
    private string $unitId;

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

        $country        = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer       = CustomerFactory::new()->create(['country_id' => $country->code]);
        $customerBranch = Branch::where('branchable_type', Customer::class)
            ->where('branchable_id', $customer->id)
            ->where('is_main_branch', true)
            ->firstOrFail();

        $this->customerId       = $customer->id;
        $this->customerBranchId = $customerBranch->id;
        $this->taxId            = TaxFactory::new()->create(['rate' => 0])->id;

        $item         = Item::factory()->create(['is_fixed_asset' => false]);
        $variant      = ItemVariantFactory::new()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $unit         = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $this->unitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $this->unitId,
            'item_id'    => $item->id,
            'unit_id'    => $unit->id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->salesOrderId = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'            => $this->salesOrderId,
            'code'          => 'SO-TEST-' . Str::random(8),
            'date'          => now(),
            'customer_id'   => $this->customerId,
            'created_by_id' => Auth::id(),
            'amount'        => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // SO 10 x 100 = 1000.
        $this->salesOrderItemId = (string) Str::ulid();
        DB::table('sales_order_items')->insert([
            'id'             => $this->salesOrderItemId,
            'sales_order_id' => $this->salesOrderId,
            'item_id'        => $variant->id,
            'quantity'       => 10,
            'price'          => 100,
            'tax_id'         => $this->taxId,
            'tax_rate'       => 0,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        Event::fake([
            SalesOrderItemBillingChanged::class,
            SalesInvoiceGeneralLedgerPostingRequested::class,
            AssetSoldViaInvoice::class,
            DocumentDeliveryStatusRecalculationRequested::class,
        ]);
    }

    /** @return array<string,mixed> */
    private function row(float $quantity, float $price, array $extra = []): array {
        return [
            'id'               => (string) Str::ulid(),
            'sales_order_item' => ['id' => $this->salesOrderItemId],
            'unit'             => ['id' => $this->unitId],
            'tax'              => ['id' => $this->taxId],
            'quantity'         => $quantity,
            'price'            => $price,
            ...$extra,
        ];
    }

    /**
     * @param  array<string,mixed>  $lists
     * @return array<string,mixed>
     */
    private function payload(array $lists): array {
        $debit  = Account::firstOrCreate(['account_number' => '1200'], ['account_name' => 'AR', 'root_type' => 'asset', 'account_type' => 'accounts_receivable', 'report_type' => 'balance_sheet']);
        $income = Account::firstOrCreate(['account_number' => '4000'], ['account_name' => 'Sales', 'root_type' => 'income', 'account_type' => 'sales', 'report_type' => 'profit_and_loss']);

        return [
            'sales_order'     => ['id' => $this->salesOrderId],
            'customer'        => ['id' => $this->customerId],
            'customer_branch' => ['id' => $this->customerBranchId],
            'income_account'  => ['id' => $income->id],
            'debit_account'   => ['id' => $debit->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => now()->toDateString(),
            ...$lists,
        ];
    }

    /** @param  array<int, FormStatus>  $status */
    private function seedInvoice(float $quantity, float $price, array $status = [FormStatus::UNPAID], array $payloadOver = []): SalesInvoice {
        $invoice = app(SalesInvoiceService::class)->create($this->payload(array_merge([
            'items' => [$this->row($quantity, $price)],
        ], $payloadOver)));
        $invoice->forceFill(['status' => $status])->save();

        return $invoice->fresh();
    }

    private function markBilled(float $quantity): void {
        DB::table('sales_order_items')->where('id', $this->salesOrderItemId)->update(['billed_quantity' => $quantity]);
    }

    private function validate(array $items, array $extra = []): Validator {
        $data    = array_merge(['items' => $items], $extra);
        $request = SalesInvoiceRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $rules     = collect($request->rules())->filter(fn ($rule, $key) => str_starts_with($key, 'items'))->all();
        $validator = ValidatorFacade::make($data, $rules);
        $request->withValidator($validator);

        return $validator;
    }

    // --- simpan ---------------------------------------------------------------

    #[Test]
    public function request_counts_value_already_billed_by_approved_invoices_not_billed_quantity_times_source_price(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(5, 200);
        $this->markBilled(5);

        $validator = $this->validate([$this->row(5, 100)]);

        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('items.0.price', $errors);
        $this->assertArrayNotHasKey('items.0.quantity', $errors);
    }

    #[Test]
    public function request_allows_the_value_still_left_and_ignores_draft_and_canceled_invoices(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(5, 200, [FormStatus::DRAFT]);
        $this->seedInvoice(5, 200, [FormStatus::CANCELED]);
        $this->assertFalse($this->validate([$this->row(10, 100)])->fails());

        $this->seedInvoice(5, 100);
        $this->markBilled(5);
        $this->assertFalse($this->validate([$this->row(5, 100)])->fails());
        $this->assertTrue($this->validate([$this->row(5, 101)])->fails());
    }

    #[Test]
    public function request_nets_return_invoices_against_billed_value(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $original = $this->seedInvoice(10, 100);
        $this->seedInvoice(4, 100, [FormStatus::RETURNED], ['return_against' => ['id' => $original->id]]);
        $this->markBilled(6);

        $this->assertFalse($this->validate([$this->row(4, 100)])->fails());
        $this->assertTrue($this->validate([$this->row(4, 101)])->fails());
    }

    #[Test]
    public function request_value_error_message_states_the_remaining_value(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(4, 100);
        $this->markBilled(4);

        $message = $this->validate([$this->row(6, 150)])->errors()->first('items.0.price');

        $this->assertStringContainsString('600', $message);
        $this->assertStringNotContainsString(':remaining', $message);
    }

    #[Test]
    public function request_uses_net_value_after_header_discount(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);

        $withinNet = $this->validate([$this->row(10, 110)], ['discount_on' => 'net_total', 'discount_rate' => 0, 'discount_amount' => 100]);
        $this->assertFalse($withinNet->fails(), json_encode($withinNet->errors()->toArray()));

        $overNet = $this->validate([$this->row(10, 111)], ['discount_on' => 'net_total', 'discount_rate' => 0, 'discount_amount' => 100]);
        $this->assertArrayHasKey('items.0.price', $overNet->errors()->toArray());

        DB::table('sales_order_items')->where('id', $this->salesOrderItemId)->update(['discount_amount' => 100]);
        $this->assertTrue($this->validate([$this->row(10, 100)])->fails(), 'Sumber ber-diskon: nilai neto SO 900.');
        $discounted = $this->validate([$this->row(10, 90)]);
        $this->assertFalse($discounted->fails(), json_encode($discounted->errors()->toArray()));
    }

    #[Test]
    public function request_with_null_tolerance_stays_neutral(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => null]);
        $this->seedInvoice(5, 200);
        $this->markBilled(5);

        $this->assertFalse($this->validate([$this->row(5, 500)])->fails());
    }

    // --- approve --------------------------------------------------------------

    #[Test]
    public function approval_rejects_second_invoice_that_pushes_cumulative_value_over_the_limit(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $service = app(SalesInvoiceService::class);

        $first = $service->create($this->payload(['items' => [$this->row(5, 200)]]));
        $service->onApproved($first->fresh());
        $this->markBilled(5);

        $second = $service->create($this->payload(['items' => [$this->row(5, 100)]]));

        try {
            $service->onApproved($second->fresh());
            $this->fail('Ekspektasi approval menolak nilai kumulatif 1500 > 1000.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString(': 0)', (string) ($exception->errors()['items'][0] ?? ''));
        }
    }

    #[Test]
    public function approval_states_the_remaining_value_and_allows_what_is_left(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $service = app(SalesInvoiceService::class);

        $first = $service->create($this->payload(['items' => [$this->row(4, 100)]]));
        $service->onApproved($first->fresh());
        $this->markBilled(4);

        $over = $service->create($this->payload(['items' => [$this->row(6, 150)]]));
        try {
            $service->onApproved($over->fresh());
            $this->fail('Ekspektasi ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString('600', (string) ($exception->errors()['items'][0] ?? ''));
        }

        $fit = $service->create($this->payload(['items' => [$this->row(6, 100)]]));
        $this->assertNotNull($service->onApproved($fit->fresh()));
    }

    // --- mata uang dokumen (B2) ---------------------------------------------------

    private function useSalesOrderInUsd(float $exchangeRate = 15000): void {
        Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar']);
        Currency::firstOrCreate(['code' => 'EUR'], ['name' => 'Euro']);
        DB::table('sales_orders')->where('id', $this->salesOrderId)->update(['currency_code' => 'USD', 'exchange_rate' => $exchangeRate]);
        DB::table('sales_order_items')->where('id', $this->salesOrderItemId)->update(['exchange_rate' => $exchangeRate]);
    }

    /** @return array<string, mixed> */
    private function usd(float $exchangeRate): array {
        return ['currency' => ['code' => 'USD'], 'exchange_rate' => $exchangeRate];
    }

    #[Test]
    public function same_currency_with_a_different_exchange_rate_is_not_a_rate_change_or_over_billing(): void {
        $this->useSalesOrderInUsd(15000);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        $validator = $this->validate([$this->row(10, 100)], $this->usd(15500));

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function same_currency_real_price_increase_is_still_detected_and_over_billed(): void {
        $this->useSalesOrderInUsd(15000);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        $errors = $this->validate([$this->row(10, 101)], $this->usd(15500))->errors()->toArray();

        $this->assertCount(2, $errors['items.0.price']);
    }

    #[Test]
    public function different_currency_keeps_the_base_currency_conversion(): void {
        $this->useSalesOrderInUsd(15000);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);

        $validator = $this->validate([$this->row(10, 100)], ['currency' => ['code' => 'EUR'], 'exchange_rate' => 17000]);
        $this->assertArrayHasKey('items.0.price', $validator->errors()->toArray());

        $equivalent = $this->validate([$this->row(10, 1500000 / 17000)], ['currency' => ['code' => 'EUR'], 'exchange_rate' => 17000]);
        $this->assertFalse($equivalent->fails(), json_encode($equivalent->errors()->toArray()));
    }

    #[Test]
    public function same_currency_accumulates_billed_value_in_the_source_currency(): void {
        $this->useSalesOrderInUsd(15000);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $this->seedInvoice(5, 100, [FormStatus::UNPAID], ['currency' => ['code' => 'USD'], 'exchange_rate' => 15200]);
        $this->markBilled(5);

        $this->assertFalse($this->validate([$this->row(5, 100)], $this->usd(15500))->fails());
        $this->assertTrue($this->validate([$this->row(5, 101)], $this->usd(15500))->fails());
    }

    #[Test]
    public function approval_same_currency_with_a_different_exchange_rate_passes_and_a_real_increase_is_rejected(): void {
        $this->useSalesOrderInUsd(15000);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0, 'rate_change_action' => 'stop']);
        $service = app(SalesInvoiceService::class);

        $ok = $service->create($this->payload(['items' => [$this->row(10, 100)], ...$this->usd(15500)]));
        $this->assertNotNull($service->onApproved($ok->fresh()));

        $over = $service->create($this->payload(['items' => [$this->row(10, 101)], ...$this->usd(15500)]));
        $this->expectException(ValidationException::class);
        $service->onApproved($over->fresh());
    }

    #[Test]
    public function approval_different_currency_still_uses_base_currency(): void {
        $this->useSalesOrderInUsd(15000);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $service = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload(['items' => [$this->row(10, 100)], 'currency' => ['code' => 'EUR'], 'exchange_rate' => 17000]));
        $this->expectException(ValidationException::class);
        $service->onApproved($invoice->fresh());
    }

    // --- pajak wajib (B1) -----------------------------------------------------------

    #[Test]
    public function row_without_tax_is_rejected_unless_an_explicit_no_tax_rule_matches(): void {
        $row = $this->row(1, 100);
        unset($row['tax']);

        $this->assertArrayHasKey('items.0.tax.id', $this->validate([$row])->errors()->toArray());

        $item = Item::query()->whereHas('variants', fn ($query) => $query->whereKey(DB::table('sales_order_items')->where('id', $this->salesOrderItemId)->value('item_id')))->firstOrFail();
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_invoice', 'item_type' => $item->type, 'tax_id' => null, 'priority' => 0]);
        $this->assertFalse($this->validate([$row])->fails());
    }

    #[Test]
    public function no_tax_rule_of_another_document_type_or_a_deleted_tax_rule_keeps_tax_required(): void {
        $item = Item::query()->whereHas('variants', fn ($query) => $query->whereKey(DB::table('sales_order_items')->where('id', $this->salesOrderItemId)->value('item_id')))->firstOrFail();
        $row  = $this->row(1, 100);
        unset($row['tax']);

        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_order', 'item_type' => $item->type, 'tax_id' => null, 'priority' => 0]);
        $this->assertArrayHasKey('items.0.tax.id', $this->validate([$row])->errors()->toArray());

        $deleted = TaxFactory::new()->create();
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_invoice', 'item_type' => $item->type, 'tax_id' => $deleted->id, 'priority' => 0]);
        $deleted->delete();
        $this->assertArrayHasKey('items.0.tax.id', $this->validate([$row])->errors()->toArray());
    }

    #[Test]
    public function approval_reads_billed_value_with_a_lock_but_save_does_not(): void {
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $service   = app(SalesInvoiceService::class);
        $invoice   = $service->create($this->payload(['items' => [$this->row(1, 100)]]));
        $lockFlags = [];
        $this->partialMock(InvoiceBilledValueResolver::class, function ($mock) use (&$lockFlags): void {
            $mock->shouldReceive('billedValues')->andReturnUsing(function (...$args) use (&$lockFlags): array {
                $lockFlags[] = $args[5] ?? false;

                return [];
            });
        });

        // Hook validasi baru berjalan saat fails() dipanggil.
        $this->validate([$this->row(1, 100)])->fails();
        app(SalesInvoiceService::class)->onApproved($invoice->fresh());

        $this->assertSame([false, true], $lockFlags);
    }
}
