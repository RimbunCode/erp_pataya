<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Posting Payment Entry (titik posting #5, Lampiran B PRD), setelah hotfix N-4/F-10.
 *
 * Posting sinkron di dalam `onApproved` (tanpa queue, tanpa `GlPostingStatus`), berbeda dari invoice (F-05).
 * Arah: debit `account_paid_to`, kredit `account_paid_from` (receive: Dr kas, Cr piutang). Pembayaran parsial ada di
 * `PaymentEntryPartialPaymentTest`; valuta asing (F-11) masih known-issue di `Characterization/KnownIssues`.
 */
class PaymentEntryPostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    public function test_full_payment_debits_paid_to_and_credits_paid_from_with_payment_date(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        // Debit = `account_paid_to` (kas), kredit = `account_paid_from` (piutang), tanpa memandang payment_type.
        $this->assertLedger($payment, [
            ['account' => $this->cash, 'against' => $this->receivable, 'debit' => 1_000_000, 'credit' => 0],
            ['account' => $this->receivable, 'against' => $this->cash, 'debit' => 0, 'credit' => 1_000_000],
        ], now()->subDay()->toDateString());
    }

    public function test_payment_updates_invoice_schedule_and_own_status_synchronously(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $invoice = $invoice->fresh();
        $this->assertEquals(1_000_000, $invoice->paid_amount);
        $this->assertContains(FormStatus::PAID, $invoice->status);
        $this->assertNotContains(FormStatus::UNPAID, $invoice->status);
        $this->assertContains(FormStatus::PAID, $payment->fresh()->status);
        $this->assertEquals(1_000_000, PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->value('paid_amount'));
    }

    public function test_payment_posting_is_not_tracked_by_gl_posting_status(): void {
        // Payment Entry dan Stock Entry posting sinkron: "tidak dilacak", bukan anomali (audit Req. 2.3).
        $invoice = $this->makeUnpaidSalesInvoice(500);
        $payment = $this->makePaymentEntry($invoice, 500, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertSame(0, GlPostingStatus::where('referenceable_type', PaymentEntry::class)->count());
        $this->assertCount(2, $this->ledgerOf($payment));
    }

    public function test_payment_does_not_fill_partyable_on_ledger_rows(): void {
        // F-18 berlaku juga di pembayaran: GL tidak membawa pihak (pelanggan/pemasok).
        $invoice = $this->makeUnpaidSalesInvoice(500);
        $payment = $this->makePaymentEntry($invoice, 500, $this->receivable, $this->cash);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertTrue($this->ledgerOf($payment)->every(fn ($row) => $row->partyable_id === null));
    }
}
