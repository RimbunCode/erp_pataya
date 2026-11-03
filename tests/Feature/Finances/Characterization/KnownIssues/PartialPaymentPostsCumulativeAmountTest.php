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
 * Known-issue F-10 (PRD Lampiran A): dugaan GL pembayaran ke-2 memposting total kumulatif, bukan jumlah
 * pembayaran itu. Test menegaskan perilaku AKTUAL; dibalik bila bug diperbaiki. Tidak ada perbaikan di Fase 0.
 */
#[Group('known-issue')]
class PartialPaymentPostsCumulativeAmountTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    public function test_f10_second_partial_payment_posts_cumulative_amount_instead_of_its_own(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $first   = $this->makePaymentEntry($invoice, 400_000, $this->cash, $this->receivable);
        $second  = $this->makePaymentEntry($invoice, 300_000, $this->cash, $this->receivable);

        $service = app(PaymentEntryService::class);
        $service->onApproved($first->fresh());
        $service->onApproved($second->fresh());

        $glFirst  = $this->ledgerOf($first)->firstWhere('account_id', $this->cash->id);
        $glSecond = $this->ledgerOf($second)->firstWhere('account_id', $this->cash->id);

        $this->assertEqualsWithDelta(400_000, $glFirst->debit, 0.01, 'Pembayaran pertama memposting jumlahnya sendiri.');

        // F-10 TERKONFIRMASI: pembayaran kedua bernilai 300.000 tetapi GL memposting total kumulatif 700.000.
        $this->assertEqualsWithDelta(700_000, $glSecond->debit, 0.01);
        $this->assertNotEquals(300_000, $glSecond->debit);

        $this->assertEqualsWithDelta(700_000, $invoice->fresh()->paid_amount, 0.01, 'Saldo faktur benar (kumulatif); hanya GL yang berlebih.');
        $this->assertEqualsWithDelta(1_100_000, $this->ledgerOf($first)->sum('debit') + $this->ledgerOf($second)->sum('debit'), 0.01, 'Total debit kas 1.100.000 untuk pembayaran 700.000.');
    }
}
