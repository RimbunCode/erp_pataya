<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Core\DocumentSubmitted;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Hotfix Payment Entry, keputusan Q10 (a) dan (c): `update` hanya untuk draft, dan `onApproved` hanya menerapkan
 * Payment Entry berstatus `draft` atau `need_approval` (idempoten terhadap `paid`, `canceled`, `rejected`).
 * `lockForUpdate` tidak berefek di SQLite, sehingga konkurensi diuji lewat idempotensi.
 */
class PaymentEntryStatusGuardTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PurchaseInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    /**
     * @return array<string, mixed>
     */
    private function updatePayload(PaymentEntry $payment, float $amount): array {
        return [
            'payment_type'      => 'receive',
            'paid_amount'       => $amount,
            'base_paid_amount'  => $amount,
            'partyable'         => ['id' => $payment->partyable_id],
            'paymentable'       => ['id' => $payment->paymentable_id],
            'account_paid_to'   => ['id' => $payment->account_paid_to_id],
            'account_paid_from' => ['id' => $payment->account_paid_from_id],
        ];
    }

    public function test_update_of_a_draft_payment_entry_is_applied(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->update($payment, $this->updatePayload($payment, 250_000));

        $this->assertEqualsWithDelta(250_000, $payment->fresh()->paid_amount, 0.01);
    }

    /**
     * @return array<string, array{0: list<FormStatus>}>
     */
    public static function nonDraftStatuses(): array {
        return [
            'paid'          => [[FormStatus::PAID]],
            'need_approval' => [[FormStatus::NEED_APPROVAL]],
            'canceled'      => [[FormStatus::CANCELED]],
            'rejected'      => [[FormStatus::REJECTED]],
        ];
    }

    /**
     * @param  list<FormStatus>  $status
     */
    #[DataProvider('nonDraftStatuses')]
    public function test_update_of_a_non_draft_payment_entry_is_rejected_and_changes_nothing(array $status): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash, ['status' => $status]);

        try {
            app(PaymentEntryService::class)->update($payment, $this->updatePayload($payment, 999_999));
            $this->fail('Update non-draft harus ditolak.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        $this->assertEqualsWithDelta(400_000, $payment->fresh()->paid_amount, 0.01);
    }

    public function test_update_uses_the_locked_status_not_the_stale_model(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);
        $stale   = PaymentEntry::find($payment->id);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        try {
            app(PaymentEntryService::class)->update($stale, $this->updatePayload($payment, 999_999));
            $this->fail('Model basi berstatus draft tidak boleh lolos guard.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        $this->assertEqualsWithDelta(400_000, $payment->fresh()->paid_amount, 0.01);
    }

    public function test_on_approved_twice_applies_the_payment_once(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->onApproved($payment->fresh());
        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertCount(2, $this->ledgerOf($payment), 'Posting GL tidak ganda.');
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
    }

    public function test_on_approved_with_a_stale_draft_model_does_not_reapply_a_paid_payment_entry(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);
        $stale   = PaymentEntry::find($payment->id);

        app(PaymentEntryService::class)->onApproved($payment->fresh());
        app(PaymentEntryService::class)->onApproved($stale);

        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertCount(2, $this->ledgerOf($payment));
    }

    public function test_on_approved_applies_a_need_approval_payment_entry(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash, ['status' => [FormStatus::NEED_APPROVAL]]);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
        $this->assertCount(2, $this->ledgerOf($payment));
    }

    /**
     * @return array<string, array{0: list<FormStatus>}>
     */
    public static function terminalStatuses(): array {
        return [
            'canceled' => [[FormStatus::CANCELED]],
            'rejected' => [[FormStatus::REJECTED]],
        ];
    }

    /**
     * @param  list<FormStatus>  $status
     */
    #[DataProvider('terminalStatuses')]
    public function test_on_approved_is_a_no_op_for_canceled_or_rejected_payment_entry(array $status): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash, ['status' => $status]);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertEqualsWithDelta(0, $invoice->fresh()->paid_amount, 0.01);
        $this->assertCount(0, $this->ledgerOf($payment));
        $this->assertSame($status, $payment->fresh()->status);
    }

    public function test_on_approved_after_cancel_does_not_resurrect_the_payment(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash, ['status' => [FormStatus::NEED_APPROVAL]]);
        $stale   = PaymentEntry::find($payment->id);

        app(PaymentEntryService::class)->cancel($payment->fresh());
        app(PaymentEntryService::class)->onApproved($stale);

        $this->assertEqualsWithDelta(0, $invoice->fresh()->paid_amount, 0.01);
        $this->assertContains(FormStatus::CANCELED, $payment->fresh()->status);
        $this->assertCount(0, $this->ledgerOf($payment));
    }

    public function test_pay_payment_entry_on_a_purchase_invoice_debits_paid_to_and_credits_paid_from(): void {
        $payable = $this->makeAccount('2100', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $invoice = $this->makeUnpaidPurchaseInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->cash, $payable);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $invoice = $invoice->fresh();
        $this->assertEqualsWithDelta(400_000, $invoice->paid_amount, 0.01);
        $this->assertContains(FormStatus::PARTIALLY_PAID, $invoice->status);
        $this->assertLedger($payment, [
            ['account' => $payable, 'against' => $this->cash, 'debit' => 400_000, 'credit' => 0],
            ['account' => $this->cash, 'against' => $payable, 'debit' => 0, 'credit' => 400_000],
        ]);
    }

    public function test_on_approved_with_a_stale_model_rejects_a_paymentable_swapped_concurrently(): void {
        $invoiceA = $this->makeUnpaidSalesInvoice(1_000_000);
        $invoiceB = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment  = $this->makePaymentEntry($invoiceA, 400_000, $this->receivable, $this->cash);
        $stale    = PaymentEntry::find($payment->id);

        // `update` draft yang bersamaan mengganti paymentable sebelum onApproved mengunci PE.
        DB::table('payment_entries')->where('id', $payment->id)->update(['paymentable_id' => $invoiceB->id]);

        try {
            app(PaymentEntryService::class)->onApproved($stale);
            $this->fail('Paymentable yang berubah harus ditolak.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('paymentable', $exception->errors());
        }

        foreach ([$invoiceA, $invoiceB] as $invoice) {
            $this->assertEqualsWithDelta(0, $invoice->fresh()->paid_amount, 0.01);
            $this->assertContains(FormStatus::UNPAID, $invoice->fresh()->status);
            $this->assertEqualsWithDelta(0, PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->sum('paid_amount'), 0.01);
        }
        $this->assertContains(FormStatus::DRAFT, $payment->fresh()->status);
        $this->assertCount(0, $this->ledgerOf($payment));
    }

    public function test_first_submit_of_a_draft_applies_the_payment_and_dispatches_document_submitted(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);
        Event::fake([DocumentSubmitted::class]);

        app(PaymentEntryService::class)->submit($payment->fresh());

        Event::assertDispatchedTimes(DocumentSubmitted::class, 1);
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertCount(2, $this->ledgerOf($payment));
    }

    public function test_submitting_twice_is_rejected_and_changes_nothing(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);
        $service = app(PaymentEntryService::class);

        $service->submit($payment->fresh());
        $codeAfterFirst = $payment->fresh()->code;
        Event::fake([DocumentSubmitted::class]);

        try {
            $service->submit($payment->fresh());
            $this->fail('Submit kedua atas PE paid harus ditolak.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        Event::assertNotDispatched(DocumentSubmitted::class);
        $this->assertSame($codeAfterFirst, $payment->fresh()->code, 'Kode PE tidak berganti.');
        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertEquals([400_000.0, 0.0], PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->orderBy('due_date')->orderBy('id')->pluck('paid_amount')->map(fn ($value) => (float) $value)->all());
        $this->assertCount(2, $this->ledgerOf($payment));
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
    }

    /**
     * @param  list<FormStatus>  $status
     */
    #[DataProvider('nonDraftStatuses')]
    public function test_submit_of_a_non_draft_payment_entry_is_rejected(array $status): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash, ['status' => $status, 'code' => 'PE-FIXED']);
        Event::fake([DocumentSubmitted::class]);

        try {
            app(PaymentEntryService::class)->submit($payment->fresh());
            $this->fail('Submit non-draft harus ditolak.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        Event::assertNotDispatched(DocumentSubmitted::class);
        $this->assertSame('PE-FIXED', $payment->fresh()->code);
        $this->assertSame($status, $payment->fresh()->status);
        $this->assertEqualsWithDelta(0, $invoice->fresh()->paid_amount, 0.01);
    }

    public function test_submit_with_a_stale_draft_model_is_rejected_when_the_payment_entry_is_already_paid(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);
        $stale   = PaymentEntry::find($payment->id);

        app(PaymentEntryService::class)->onApproved($payment->fresh());
        Event::fake([DocumentSubmitted::class]);

        try {
            app(PaymentEntryService::class)->submit($stale);
            $this->fail('Status dibaca ulang di bawah kunci, bukan dari model basi.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        Event::assertNotDispatched(DocumentSubmitted::class);
        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertCount(2, $this->ledgerOf($payment));
    }
}
