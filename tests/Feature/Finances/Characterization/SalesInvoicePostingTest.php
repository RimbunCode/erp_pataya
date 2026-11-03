<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\SalesInvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #1, Lampiran B PRD): Sales Invoice.
 *
 * Mengunci perilaku SAAT INI dari `SalesInvoiceService::onApproved` sampai baris GL, bukan perilaku yang
 * diharapkan. Fase 2 memakai test ini sebagai parity test; perubahan nilai di sini harus disengaja.
 */
class SalesInvoicePostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $sales;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class]);
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->sales      = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $itemAttributes
     */
    private function makeInvoice(array $attributes = [], array $itemAttributes = []): SalesInvoice {
        return $this->makeSalesInvoice($this->receivable, $this->sales, $attributes, $itemAttributes);
    }

    private function approve(SalesInvoice $invoice): SalesInvoice {
        app(SalesInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh();
    }

    public function test_normal_invoice_posts_receivable_debit_and_sales_credit_of_total_including_tax(): void {
        $invoice = $this->approve($this->makeInvoice());

        // F-17: pajak dihitung dari DPP 11/12: 2.000 × 11/12 × 10% = 183,33; total 2.183,33 (satu pasang, pajak tidak dipisah, F-03).
        $this->assertLedger($invoice, [
            ['account' => $this->receivable, 'against' => $this->sales, 'debit' => 2183.33, 'credit' => 0],
            ['account' => $this->sales, 'against' => $this->receivable, 'debit' => 0, 'credit' => 2183.33],
        ], now()->toDateString());

        $this->assertEqualsWithDelta(2183.33, $invoice->amount, 0.01);
        $this->assertContains(FormStatus::UNPAID, $invoice->status);
        $this->assertPostingStatus($invoice, 'posted');
    }

    public function test_gl_transaction_date_is_approval_time_not_document_date(): void {
        // F-19: tanggal dokumen 5 hari lalu, tetapi `transaction_date` GL = now() saat approve.
        $invoice = $this->approve($this->makeInvoice());

        $this->assertSame(now()->subDays(5)->toDateString(), $invoice->date->toDateString());
        $this->assertSame(now()->toDateString(), $this->ledgerOf($invoice)->first()->transaction_date->toDateString());
    }

    public function test_invoice_posting_does_not_fill_partyable_on_ledger_rows(): void {
        // F-18: buku besar pembantu per pihak tidak dapat diturunkan dari GL.
        $invoice = $this->approve($this->makeInvoice());

        $this->assertTrue($this->ledgerOf($invoice)->every(fn ($row) => $row->partyable_type === null && $row->partyable_id === null));
    }

    public function test_return_invoice_posts_reversed_debit_and_credit(): void {
        $original     = $this->approve($this->makeInvoice());
        $originalItem = $original->items()->first();

        $return = $this->makeInvoice(
            ['return_against_id' => $original->id],
            ['quantity' => 1, 'return_against_item_id' => $originalItem->id],
        );
        $return = $this->approve($return);

        // 1 × 1.000, pajak 1.000 × 11/12 × 10% = 91,67 → 1.091,67, debit/kredit terbalik.
        $this->assertLedger($return, [
            ['account' => $this->sales, 'against' => $this->receivable, 'debit' => 1091.67, 'credit' => 0],
            ['account' => $this->receivable, 'against' => $this->sales, 'debit' => 0, 'credit' => 1091.67],
        ], now()->toDateString());

        $this->assertContains(FormStatus::RETURNED, $return->status);
        $this->assertPostingStatus($return, 'posted');
        $this->assertCount(2, $this->ledgerOf($original), 'Jurnal faktur asal tidak berubah oleh retur.');
    }
}
