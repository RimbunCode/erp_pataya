<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Validator;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Hotfix Payment Entry lewat lapisan HTTP: default akun dari Purchase Invoice (Q2 a/b), validasi `paid_amount`
 * (Q9 b), guard `update` non-draft (Q10 a), dan pembatalan yang ditolak (Q5) melalui controller.
 */
class PaymentEntryHttpTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        // SQLite test tidak punya json_overlaps (fungsi MySQL), yang dipakai `PaymentEntryController::create`
        // untuk mencari draft milik user; shim ini meniru irisan dua array JSON (pola DeliveryNoteReturnConnectionTest).
        DB::connection()->getPdo()->sqliteCreateFunction('json_overlaps', function (?string $a, ?string $b): int {
            $left  = json_decode($a ?? '[]', true) ?? [];
            $right = json_decode($b ?? '[]', true) ?? [];

            return array_intersect($left, $right) !== [] ? 1 : 0;
        }, 2);

        $this->setUpFinanceFixtures([SalesInvoice::class, PurchaseInvoice::class, PaymentSchedule::class, PaymentEntry::class, PaymentMethod::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionWithPermission(): array {
        return [
            'permissions' => [
                PaymentEntry::class => [
                    0 => [
                        [
                            'model'        => PaymentEntry::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true, 'cancel' => true, 'submit' => true],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function http(): static {
        return $this
            ->withSession($this->sessionWithPermission())
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    /**
     * @return array<string, mixed>
     */
    private function receivePayload(PaymentEntry $payment, float $amount): array {
        return [
            'date'              => now()->toDateString(),
            'payment_type'      => 'receive',
            'party_type'        => 'customer',
            'paid_amount'       => $amount,
            'partyable'         => ['id' => $payment->partyable_id],
            'paymentable'       => ['id' => $payment->paymentable_id],
            'account_paid_from' => ['id' => $payment->account_paid_from_id],
            'account_paid_to'   => ['id' => $payment->account_paid_to_id],
        ];
    }

    private function applied(SalesInvoice $invoice, float $amount): PaymentEntry {
        $payment = $this->makePaymentEntry($invoice, $amount, $this->receivable, $this->cash);
        app(PaymentEntryService::class)->onApproved($payment->fresh());

        return $payment->fresh();
    }

    public function test_purchase_invoice_default_uses_bank_as_paid_from_and_payable_as_paid_to(): void {
        $payable = $this->makeAccount('2100', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $bank    = $this->makeAccount('1110', 'Bank', 'asset', 'debit', 'bank');
        $invoice = $this->makeUnpaidPurchaseInvoice(1_000_000);
        $method  = PaymentMethod::create(['name' => 'Transfer', 'default_account_id' => $bank->id]);
        PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->update(['payment_method_id' => $method->id]);
        PurchaseInvoice::whereKey($invoice->id)->update(['credit_account_id' => $payable->id]);

        $response = $this->http()->get('/paymentEntries/create/purchaseInvoice/' . $invoice->id);

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Finances/PaymentEntries/Show')
                ->where('defaultData.payment_type', 'pay')
                ->where('defaultData.account_paid_from.id', $bank->id)
                ->where('defaultData.account_paid_to.id', $payable->id),
        );
    }

    public function test_zero_paid_amount_is_rejected(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 100, $this->receivable, $this->cash);

        $response = $this->http()->post('/paymentEntries', $this->receivePayload($payment, 0));

        $response->assertSessionHasErrors('paid_amount');
        $this->assertSame(1, PaymentEntry::count());
    }

    public function test_paid_amount_above_outstanding_is_rejected(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 100, $this->receivable, $this->cash);

        $response = $this->http()->post('/paymentEntries', $this->receivePayload($payment, 1_000_000.5));

        $response->assertSessionHasErrors('paid_amount');
        $this->assertSame(1, PaymentEntry::count());
    }

    public function test_paid_amount_equal_to_outstanding_is_accepted(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 100, $this->receivable, $this->cash);

        $response = $this->http()->post('/paymentEntries', $this->receivePayload($payment, 1_000_000));

        $response->assertSessionDoesntHaveErrors('paid_amount');
        $this->assertSame(2, PaymentEntry::count());
    }

    public function test_outstanding_limit_accounts_for_earlier_payments(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->applied($invoice, 400_000);

        $this->http()->post('/paymentEntries', $this->receivePayload($payment, 600_001))->assertSessionHasErrors('paid_amount');
        $this->http()->post('/paymentEntries', $this->receivePayload($payment, 600_000))->assertSessionDoesntHaveErrors('paid_amount');
    }

    /**
     * Aturan `paid_amount` dievaluasi pada request nyata (closure batas atas membaca input request).
     *
     * @param  array<string, mixed>  $input
     */
    private function paidAmountPasses(array $input): bool {
        $request = PaymentEntryRequest::create('/paymentEntries', 'POST', $input);
        $request->setContainer(app());

        return Validator::make($request->all(), ['paid_amount' => $request->rules()['paid_amount']])->passes();
    }

    public function test_upper_limit_does_not_apply_to_internal_transfer(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000);
        $input   = ['party_type' => 'customer', 'paid_amount' => 5_000, 'paymentable' => ['id' => $invoice->id]];

        $this->assertFalse($this->paidAmountPasses([...$input, 'payment_type' => 'receive']), 'Kontrol: jumlah di atas sisa ditolak untuk tipe receive.');
        $this->assertTrue($this->paidAmountPasses([...$input, 'payment_type' => 'internal_transfer']), 'internal_transfer tidak terkena batas atas.');
    }

    public function test_upper_limit_does_not_apply_to_return_documents(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000);
        $return  = $this->makeUnpaidSalesInvoice(1_000);
        SalesInvoice::whereKey($return->id)->update(['return_against_id' => $invoice->id]);

        $this->assertTrue($this->paidAmountPasses(['payment_type' => 'pay', 'party_type' => 'customer', 'paid_amount' => 5_000, 'paymentable' => ['id' => $return->id]]));
        $this->assertFalse($this->paidAmountPasses(['payment_type' => 'receive', 'party_type' => 'customer', 'paid_amount' => 5_000, 'paymentable' => ['id' => $invoice->id]]), 'Kontrol: dokumen non-retur tetap dibatasi.');
    }

    public function test_update_of_a_draft_payment_entry_succeeds_over_http(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);

        $response = $this->http()->put('/paymentEntries/' . $payment->id, $this->receivePayload($payment, 250_000));

        $response->assertSessionHasNoErrors();
        $this->assertEqualsWithDelta(250_000, $payment->fresh()->paid_amount, 0.01);
    }

    public function test_update_of_a_paid_payment_entry_is_rejected_over_http(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->applied($invoice, 400_000);

        $response = $this->http()->put('/paymentEntries/' . $payment->id, $this->receivePayload($payment, 100_000));

        $response->assertSessionHasErrors('status');
        $this->assertEqualsWithDelta(400_000, $payment->fresh()->paid_amount, 0.01);
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
    }

    public function test_cancel_over_http_reverses_the_invoice(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->applied($invoice, 400_000);

        $response = $this->http()->put('/paymentEntries/' . $payment->id . '/cancel');

        $response->assertSessionHasNoErrors();
        $this->assertContains(FormStatus::CANCELED, $payment->fresh()->status);
        $this->assertEqualsWithDelta(0, $invoice->fresh()->paid_amount, 0.01);
        $this->assertContains(FormStatus::UNPAID, $invoice->fresh()->status);
    }

    public function test_cancel_that_would_go_negative_is_rejected_and_rolled_back_over_http(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->applied($invoice, 400_000);
        SalesInvoice::whereKey($invoice->id)->update(['paid_amount' => 100_000]);
        $scheduleBefore = PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->value('paid_amount');

        $response = $this->http()->put('/paymentEntries/' . $payment->id . '/cancel');

        $response->assertSessionHasErrors('status');
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
        $this->assertEqualsWithDelta(100_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertEquals($scheduleBefore, PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->value('paid_amount'));
        $this->assertSame(0, $this->ledgerOf($payment)->filter(fn ($row) => $row->deleted_at !== null)->count());
    }

    public function test_failure_after_schedule_allocation_rolls_back_over_http(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $this->applied($invoice, 300_000);
        $second          = $this->applied($invoice, 500_000);
        $schedulesBefore = PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->orderBy('due_date')->pluck('paid_amount')->all();

        // Paksa galat pada simpan paymentable, yang terjadi setelah `allocateToSchedules` di `cancel`.
        Event::listen('eloquent.saving: ' . SalesInvoice::class, function (): void {
            throw new \RuntimeException('gagal setelah alokasi jadwal');
        });

        $this->withoutExceptionHandling();
        try {
            $this->http()->put('/paymentEntries/' . $second->id . '/cancel');
            $this->fail('Galat harus merambat.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('gagal setelah alokasi jadwal', $exception->getMessage());
        }

        $this->assertEquals($schedulesBefore, PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->orderBy('due_date')->pluck('paid_amount')->all());
        $this->assertEqualsWithDelta(800_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertContains(FormStatus::PAID, $second->fresh()->status);
    }

    public function test_submit_over_http_applies_once_and_second_submit_is_rejected(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);

        $this->http()->put('/paymentEntries/' . $payment->id . '/submit')->assertSessionHasNoErrors();
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
        $code = $payment->fresh()->code;

        $this->http()->put('/paymentEntries/' . $payment->id . '/submit')->assertSessionHasErrors('status');

        $this->assertSame($code, $payment->fresh()->code);
        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertCount(2, $this->ledgerOf($payment));
    }

    public function test_sales_invoice_default_amount_is_the_outstanding_balance_and_is_accepted_on_store(): void {
        $bank    = $this->makeAccount('1110', 'Bank', 'asset', 'debit', 'bank');
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $method  = PaymentMethod::create(['name' => 'Transfer', 'default_account_id' => $bank->id]);
        PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->update(['payment_method_id' => $method->id]);
        $payment = $this->applied($invoice, 400_000);

        $response = $this->http()->get('/paymentEntries/create/salesInvoice/' . $invoice->id);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData.paid_amount', fn ($value) => abs((float) $value - 600_000) < 0.01));

        $this->http()->post('/paymentEntries', $this->receivePayload($payment, 600_000))->assertSessionDoesntHaveErrors('paid_amount');
    }

    public function test_sales_invoice_default_amount_is_capped_by_the_invoice_outstanding(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $this->applied($invoice, 400_000);
        // Data tidak konsisten: sisa jadwal (600.000) melebihi sisa faktur (200.000).
        SalesInvoice::whereKey($invoice->id)->update(['paid_amount' => 800_000]);

        $response = $this->http()->get('/paymentEntries/create/salesInvoice/' . $invoice->id);

        $response->assertInertia(fn ($page) => $page->where('defaultData.paid_amount', fn ($value) => abs((float) $value - 200_000) < 0.01));
    }

    public function test_default_amount_skips_fully_paid_schedules_and_future_installments(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $this->applied($invoice, 500_000);

        $response = $this->http()->get('/paymentEntries/create/salesInvoice/' . $invoice->id);

        // Jadwal pertama lunas dilewati; jadwal kedua belum jatuh tempo (idx > 0) sehingga tidak ikut.
        $response->assertInertia(fn ($page) => $page->where('defaultData.paid_amount', fn ($value) => abs((float) $value) < 0.01));
    }

    public function test_purchase_invoice_default_amount_is_the_outstanding_balance(): void {
        $payable = $this->makeAccount('2100', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $invoice = $this->makeUnpaidPurchaseInvoice(1_000_000);
        PurchaseInvoice::whereKey($invoice->id)->update(['credit_account_id' => $payable->id]);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->cash, $payable);
        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $response = $this->http()->get('/paymentEntries/create/purchaseInvoice/' . $invoice->id);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData.paid_amount', fn ($value) => abs((float) $value - 600_000) < 0.01));
    }
}
