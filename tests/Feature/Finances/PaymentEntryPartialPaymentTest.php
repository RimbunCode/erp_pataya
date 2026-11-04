<?php

namespace Tests\Feature\Finances;

use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Regresi F-10 (hotfix Payment Entry): setiap pembayaran parsial memposting jumlahnya sendiri, bukan total
 * kumulatif faktur. Sebelumnya known-issue `PartialPaymentPostsCumulativeAmountTest` (GL kedua 700.000).
 */
class PaymentEntryPartialPaymentTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
    }

    public function test_each_partial_payment_posts_its_own_amount(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $first   = $this->makePaymentEntry($invoice, 400_000, $this->receivable, $this->cash);
        $second  = $this->makePaymentEntry($invoice, 300_000, $this->receivable, $this->cash);

        $service = app(PaymentEntryService::class);
        $service->onApproved($first->fresh());
        $service->onApproved($second->fresh());

        $glFirst  = $this->ledgerOf($first)->firstWhere('account_id', $this->cash->id);
        $glSecond = $this->ledgerOf($second)->firstWhere('account_id', $this->cash->id);

        $this->assertEqualsWithDelta(400_000, $glFirst->debit, 0.01);
        $this->assertEqualsWithDelta(300_000, $glSecond->debit, 0.01, 'Pembayaran kedua memposting jumlahnya sendiri, bukan total kumulatif.');

        $this->assertEqualsWithDelta(700_000, $invoice->fresh()->paid_amount, 0.01);
        $this->assertEqualsWithDelta(700_000, $this->ledgerOf($first)->sum('debit') + $this->ledgerOf($second)->sum('debit'), 0.01, 'Total debit kas sama dengan total pembayaran.');
        $this->assertEqualsWithDelta(700_000, PaymentSchedule::where('payment_scheduleable_id', $invoice->id)->value('paid_amount'), 0.01);
    }
}
