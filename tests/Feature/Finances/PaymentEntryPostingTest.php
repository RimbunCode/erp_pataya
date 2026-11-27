<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Posting Payment Entry (titik posting #5, Lampiran B PRD), setelah hotfix N-4/F-10.
 *
 * Posting sinkron di dalam `onApproved` (tanpa queue, tanpa `GlPostingStatus`), berbeda dari invoice (F-05).
 * Arah: debit `account_paid_to`, kredit `account_paid_from` (receive: Dr kas, Cr piutang). Pembayaran parsial ada di
 * `PaymentEntryPartialPaymentTest`; valuta asing (F-11) masih known-issue di `Characterization/KnownIssues`.
 */
class PaymentEntryPostingTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $cash;
    private Account $receivable;
    private PaymentMethod $method;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class, PostingProfile::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');

        // Task 14.1: closure legacy dihapus; jurnal ditulis engine (kas dari Metode Pembayaran, piutang dari profil).
        $this->enableEnginePosting(['receivable' => $this->receivable]);
        $this->method = $this->makeCashPaymentMethod($this->cash);
    }

    public function test_approval_with_unresolved_account_role_fails_as_validation_error_and_rolls_back(): void {
        // Requirement 13.7: peran tak ter-resolve menjadi galat validasi (bukan 500) yang menyebut peran dan, untuk
        // pengguna berizin `select` Posting Profile, menunjuk halamannya; dokumen tidak berstatus paid dan
        // pembayaran tidak diterapkan.
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash, ['payment_method_id' => $this->method->id]);
        Account::whereKey($this->receivable->id)->update(['is_group' => true]);
        $this->withSession(['permissions' => [PostingProfile::class => [0 => [['model' => PostingProfile::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true]]]]]]);

        try {
            app(PaymentEntryService::class)->onApproved($payment->fresh());
            $this->fail('Approve harus ditolak karena peran akun tidak dapat di-resolve.');
        } catch (ValidationException $e) {
            $message = $e->errors()['status'][0] ?? '';
            $this->assertStringContainsString('receivable', $message);
            $this->assertStringContainsString(route('postingProfiles.index', absolute: false), $message);
        }

        $this->assertNotContains(FormStatus::PAID, $payment->fresh()->status);
        $this->assertEquals(0, $invoice->fresh()->paid_amount);
        $this->assertSame(0, Journal::query()->count());
    }

    public function test_unresolved_role_error_omits_the_profile_url_for_users_who_cannot_open_posting_profiles(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash, ['payment_method_id' => $this->method->id]);
        Account::whereKey($this->receivable->id)->update(['is_group' => true]);
        $this->withSession(['permissions' => []]);

        foreach (['en', 'id'] as $locale) {
            app()->setLocale($locale);

            try {
                app(PaymentEntryService::class)->onApproved($payment->fresh());
                $this->fail('Approve harus ditolak karena peran akun tidak dapat di-resolve.');
            } catch (ValidationException $e) {
                $message = $e->errors()['status'][0] ?? '';
                $this->assertStringContainsString('receivable', $message, $locale);
                $this->assertStringNotContainsString('postingProfiles', $message, $locale);
                $this->assertStringNotContainsString(route('postingProfiles.index', absolute: false), $message, $locale);
                $this->assertStringNotContainsString(':url', $message, $locale);
            }
        }

        $this->assertNotContains(FormStatus::PAID, $payment->fresh()->status);
    }

    public function test_full_payment_debits_paid_to_and_credits_paid_from_with_payment_date(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash, ['payment_method_id' => $this->method->id]);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        // Debit = `account_paid_to` (kas), kredit = `account_paid_from` (piutang), tanpa memandang payment_type.
        $this->assertLedger($payment, [
            ['account' => $this->cash, 'against' => $this->receivable, 'debit' => 1_000_000, 'credit' => 0],
            ['account' => $this->receivable, 'against' => $this->cash, 'debit' => 0, 'credit' => 1_000_000],
        ], now()->subDay()->toDateString());
    }

    public function test_payment_updates_invoice_schedule_and_own_status_synchronously(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash, ['payment_method_id' => $this->method->id]);

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
        $payment = $this->makePaymentEntry($invoice, 500, $this->receivable, $this->cash, ['payment_method_id' => $this->method->id]);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertSame(0, GlPostingStatus::where('referenceable_type', PaymentEntry::class)->count());
        $this->assertCount(2, $this->ledgerOf($payment));
    }

    public function test_payment_does_not_fill_partyable_on_ledger_rows(): void {
        // F-18 berlaku juga di pembayaran: GL tidak membawa pihak (pelanggan/pemasok).
        $invoice = $this->makeUnpaidSalesInvoice(500);
        $payment = $this->makePaymentEntry($invoice, 500, $this->receivable, $this->cash, ['payment_method_id' => $this->method->id]);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $this->assertTrue($this->ledgerOf($payment)->every(fn ($row) => $row->partyable_id === null));
    }
}
