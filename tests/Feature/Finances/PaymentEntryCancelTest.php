<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
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
 * N-10 (hotfix Payment Entry): pembatalan Payment Entry yang sudah `paid` mengurangi total terbayar paymentable,
 * menghitung ulang status pembayaran, dan mengalokasikan ulang jadwal. Hasil negatif ditolak (keputusan Q5).
 * Bagian GL (soft-delete tanpa jurnal pembalik) tetap known-issue F-04.
 */
class PaymentEntryCancelTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    private function pay(SalesInvoice $invoice, float $amount): PaymentEntry {
        $payment = $this->makePaymentEntry($invoice, $amount, $this->receivable, $this->cash);
        app(PaymentEntryService::class)->onApproved($payment->fresh());

        return $payment->fresh();
    }

    private function cancel(PaymentEntry $payment): void {
        app(PaymentEntryService::class)->cancel($payment->fresh());
    }

    /**
     * @return list<float>
     */
    private function schedulePaidAmounts(SalesInvoice $invoice): array {
        return PaymentSchedule::where('payment_scheduleable_id', $invoice->id)
            ->orderBy('due_date')->orderBy('id')
            ->pluck('paid_amount')
            ->map(fn ($value) => (float) $value)
            ->all();
    }

    public function test_cancelling_a_full_payment_returns_the_invoice_to_unpaid(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->pay($invoice, 1_000_000);
        $this->assertContains(FormStatus::PAID, $invoice->fresh()->status);

        $this->cancel($payment);

        $invoice = $invoice->fresh();
        $this->assertEqualsWithDelta(0, $invoice->paid_amount, 0.01);
        $this->assertContains(FormStatus::UNPAID, $invoice->status);
        $this->assertNotContains(FormStatus::PAID, $invoice->status);
        $this->assertNotContains(FormStatus::PARTIALLY_PAID, $invoice->status);
        $this->assertEqualsWithDelta(0, $this->schedulePaidAmounts($invoice)[0], 0.01);
        $this->assertContains(FormStatus::CANCELED, $payment->fresh()->status);
    }

    public function test_cancelling_the_latest_partial_payment_keeps_the_earlier_one(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $this->pay($invoice, 400_000);
        $second = $this->pay($invoice, 300_000);

        $this->cancel($second);

        $invoice = $invoice->fresh();
        $this->assertEqualsWithDelta(400_000, $invoice->paid_amount, 0.01);
        $this->assertContains(FormStatus::PARTIALLY_PAID, $invoice->status);
        $this->assertNotContains(FormStatus::PAID, $invoice->status);
        $this->assertEqualsWithDelta(400_000, $this->schedulePaidAmounts($invoice)[0], 0.01);
    }

    public function test_cancelling_the_earlier_payment_is_allowed_while_total_stays_non_negative(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $first   = $this->pay($invoice, 400_000);
        $this->pay($invoice, 300_000);

        $this->cancel($first);

        $this->assertEqualsWithDelta(300_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertEqualsWithDelta(300_000, $this->schedulePaidAmounts($invoice)[0], 0.01);
    }

    public function test_cancelling_a_settling_payment_moves_status_from_paid_to_partially_paid(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $this->pay($invoice, 400_000);
        $settling = $this->pay($invoice, 600_000);
        $this->assertContains(FormStatus::PAID, $invoice->fresh()->status);

        $this->cancel($settling);

        $invoice = $invoice->fresh();
        $this->assertContains(FormStatus::PARTIALLY_PAID, $invoice->status);
        $this->assertNotContains(FormStatus::PAID, $invoice->status);
        $this->assertEqualsWithDelta(400_000, $this->schedulePaidAmounts($invoice)[0], 0.01);
    }

    public function test_cancel_reallocates_installment_schedules(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $this->pay($invoice, 500_000);
        $second = $this->pay($invoice, 200_000);
        $this->assertEqualsWithDelta(200_000, $this->schedulePaidAmounts($invoice)[1], 0.01);

        $this->cancel($second);

        $paid = $this->schedulePaidAmounts($invoice);
        $this->assertEqualsWithDelta(500_000, $paid[0], 0.01);
        $this->assertEqualsWithDelta(0, $paid[1], 0.01);
    }

    public function test_cancel_is_idempotent(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $this->pay($invoice, 400_000);
        $second = $this->pay($invoice, 300_000);

        $this->cancel($second);
        $this->cancel($second);

        $this->assertEqualsWithDelta(400_000, $invoice->fresh()->paid_amount, 0.01, 'Cancel ganda tidak mengurangi dua kali.');
    }

    public function test_cancel_that_would_make_the_total_negative_is_rejected_and_changes_nothing(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->pay($invoice, 400_000);

        // Simulasi data historis yang tidak konsisten (Q7): total faktur lebih kecil dari pembayaran ini.
        SalesInvoice::whereKey($invoice->id)->update(['paid_amount' => 100_000]);

        try {
            $this->cancel($payment);
            $this->fail('Cancel yang membuat total negatif harus ditolak.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        $this->assertContains(FormStatus::PAID, $payment->fresh()->status, 'Status Payment Entry tidak berubah.');
        $this->assertEqualsWithDelta(100_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertSame(0, $this->ledgerOf($payment)->filter(fn ($row) => $row->deleted_at !== null)->count(), 'GL tidak ikut di-soft-delete.');
    }

    /**
     * `draft` tidak dipakai: `canCancel` menolaknya di jalur nyata. Yang dapat dibatalkan tanpa pernah diterapkan
     * adalah PE yang menunggu persetujuan atau yang ditolak.
     *
     * @return array<string, array{0: list<FormStatus>}>
     */
    public static function neverAppliedStatuses(): array {
        return [
            'need_approval' => [[FormStatus::NEED_APPROVAL]],
            'rejected'      => [[FormStatus::REJECTED]],
        ];
    }

    /**
     * @param  list<FormStatus>  $status
     */
    #[DataProvider('neverAppliedStatuses')]
    public function test_cancelling_a_payment_entry_that_was_never_applied_does_not_touch_the_invoice(array $status): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $this->pay($invoice, 300_000);
        $invoiceBefore   = $invoice->fresh();
        $schedulesBefore = $this->schedulePaidAmounts($invoice);
        $payment         = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash, ['status' => $status]);

        $this->cancel($payment);

        $invoiceAfter = $invoice->fresh();
        $this->assertContains(FormStatus::CANCELED, $payment->fresh()->status);
        $this->assertEqualsWithDelta((float) $invoiceBefore->paid_amount, (float) $invoiceAfter->paid_amount, 0.01);
        $this->assertSame($invoiceBefore->status, $invoiceAfter->status);
        $this->assertSame($schedulesBefore, $this->schedulePaidAmounts($invoice));
        $this->assertCount(0, $this->ledgerOf($payment));
    }

    public function test_failure_after_schedule_allocation_rolls_back_schedules_and_paid_amount(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);
        $this->pay($invoice, 300_000);
        $second          = $this->pay($invoice, 500_000);
        $schedulesBefore = $this->schedulePaidAmounts($invoice);
        $this->assertEqualsWithDelta(500_000, $schedulesBefore[0], 0.01);
        $this->assertEqualsWithDelta(300_000, $schedulesBefore[1], 0.01);

        // `reversePayment` mengalokasikan jadwal, lalu menyimpan paymentable; simpan paymentable dipaksa gagal.
        Event::listen('eloquent.saving: ' . SalesInvoice::class, function (): void {
            throw new \RuntimeException('gagal setelah alokasi jadwal');
        });

        try {
            $this->cancel($second);
            $this->fail('Galat setelah alokasi harus merambat.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('gagal setelah alokasi jadwal', $exception->getMessage());
        }

        $this->assertSame($schedulesBefore, $this->schedulePaidAmounts($invoice), 'Alokasi jadwal ikut di-rollback.');
        $this->assertEqualsWithDelta(800_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertContains(FormStatus::PAID, $second->fresh()->status);
        $this->assertSame(0, $this->ledgerOf($second)->filter(fn ($row) => $row->deleted_at !== null)->count());
    }

    public function test_cancel_without_the_paymentable_is_rejected(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->pay($invoice, 400_000);

        SalesInvoice::withTrashed()->whereKey($invoice->id)->forceDelete();

        try {
            $this->cancel($payment);
            $this->fail('Cancel tanpa paymentable harus ditolak.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
    }

    public function test_cancel_reverses_a_soft_deleted_paymentable(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->pay($invoice, 400_000);
        // Soft-delete lewat query: `delete()` model ditolak `LinkModel` karena faktur sudah punya Payment Entry.
        DB::table('sales_invoices')->where('id', $invoice->id)->update(['deleted_at' => now()]);

        $this->cancel($payment);

        $this->assertEqualsWithDelta(0, SalesInvoice::withTrashed()->find($invoice->id)->paid_amount, 0.01);
        $this->assertContains(FormStatus::CANCELED, $payment->fresh()->status);
    }

    public function test_cancel_still_soft_deletes_the_ledger_without_reversal(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->pay($invoice, 400_000);

        $this->cancel($payment);

        $rows = $this->ledgerOf($payment);
        $this->assertCount(2, $rows, 'F-04: tidak ada jurnal pembalik.');
        $this->assertTrue($rows->every(fn ($row) => $row->deleted_at !== null));
    }
}
