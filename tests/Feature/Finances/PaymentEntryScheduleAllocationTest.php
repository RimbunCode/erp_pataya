<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * N-10 (hotfix Payment Entry): `paid_amount` jadwal pembayaran dialokasikan dari total terbayar, sehingga
 * pembayaran bertahap menambah (bukan menimpa) dan jadwal yang sudah lunas tidak di-reset.
 */
class PaymentEntryScheduleAllocationTest extends TestCase {
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

    public function test_partial_then_partial_adds_to_schedule(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);

        $this->pay($invoice, 400_000);
        $this->pay($invoice, 300_000);

        $this->assertEqualsWithDelta(700_000, $this->schedulePaidAmounts($invoice)[0], 0.01);
        $this->assertEqualsWithDelta(700_000, $invoice->fresh()->paid_amount, 0.01);
    }

    public function test_settling_the_remainder_fills_the_schedule(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);

        $this->pay($invoice, 400_000);
        $this->pay($invoice, 600_000);

        $this->assertEqualsWithDelta(1_000_000, $this->schedulePaidAmounts($invoice)[0], 0.01);
        $this->assertContains(FormStatus::PAID, $invoice->fresh()->status);
    }

    public function test_paid_schedule_is_not_reset_by_the_next_payment_on_installments(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000, [50, 50]);

        $this->pay($invoice, 500_000);
        $this->assertEqualsWithDelta(0, $this->schedulePaidAmounts($invoice)[1], 0.01);

        $this->pay($invoice, 200_000);

        $paid = $this->schedulePaidAmounts($invoice);
        $this->assertEqualsWithDelta(500_000, $paid[0], 0.01, 'Jadwal pertama yang sudah lunas tidak di-reset.');
        $this->assertEqualsWithDelta(200_000, $paid[1], 0.01);
    }

    public function test_overpayment_is_not_allocated_beyond_schedule_amount(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);

        $this->pay($invoice, 1_200_000);

        $this->assertEqualsWithDelta(1_000_000, $this->schedulePaidAmounts($invoice)[0], 0.01);
        $this->assertEqualsWithDelta(1_200_000, $invoice->fresh()->paid_amount, 0.01, 'paid_amount faktur tetap bertambah penuh.');
    }

    public function test_allocation_changes_only_paid_amount_of_schedule(): void {
        $invoice  = $this->makeUnpaidSalesInvoice(1_000_000);
        $schedule = PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->first();
        $schedule->update(['discount' => 10]);
        $before = $schedule->fresh();

        $this->pay($invoice, 400_000);

        $after = $schedule->fresh();
        $this->assertEquals($before->payment_amount, $after->payment_amount);
        $this->assertEquals($before->discount, $after->discount);
        $this->assertEquals($before->due_date, $after->due_date);
    }
}
