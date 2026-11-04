<?php

namespace Tests\Feature\Finances\Characterization\KnownIssues;

use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Known-issue F-11, bagian FX (PRD Lampiran A): GL pembayaran tidak memperhitungkan `exchange_rate`.
 * Test menegaskan nominal AKTUAL yang diposting; dibalik bila bug diperbaiki. Tidak ada perbaikan di Fase 0.
 */
#[Group('known-issue')]
class ForeignCurrencyPaymentPostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    public function test_f11_foreign_currency_payment_posts_document_currency_amount_ignoring_exchange_rate(): void {
        // Faktur 100 (mata uang asing), kurs 15.000: `base_paid_amount` 1.500.000 dalam mata uang dasar.
        $invoice = $this->makeUnpaidSalesInvoice(100);
        $payment = $this->makePaymentEntry($invoice, 100, $this->receivable, $this->cash, [
            'exchange_rate'    => 15_000,
            'base_paid_amount' => 1_500_000,
        ]);

        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $rows = $this->ledgerOf($payment);

        // F-11 (bagian FX) TERKONFIRMASI: GL memposting 100 (mata uang asing), bukan 1.500.000 (dasar),
        // dan tidak ada baris selisih kurs.
        $this->assertCount(2, $rows);
        $this->assertEqualsWithDelta(100, $rows->firstWhere('account_id', $this->cash->id)->debit, 0.01);
        $this->assertEqualsWithDelta(100, $rows->firstWhere('account_id', $this->receivable->id)->credit, 0.01);
        $this->assertEqualsWithDelta(1_500_000, $payment->fresh()->base_paid_amount, 0.01, 'Nilai dasar tersimpan di dokumen tetapi tidak sampai ke GL.');
    }
}
