<?php

namespace Tests\Feature\Finances\Characterization\KnownIssues;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Audit\GeneralLedgerAuditor;
use App\Services\Finances\SalesInvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Known-issue F-16 (PRD Lampiran A): dokumen dibatalkan sebelum listener posting yang di-queue berjalan.
 * Hook cancel (F-04) tidak menemukan baris GL untuk di-soft-delete; listener lalu memposting GL AKTIF untuk dokumen
 * `canceled`. Test menahan listener dengan `Event::fake` lalu menjalankannya setelah pembatalan.
 */
#[Group('known-issue')]
class CancelBeforeQueuedPostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    public function test_f16_listener_running_after_cancel_posts_active_ledger_for_canceled_document(): void {
        $this->setUpFinanceFixtures([SalesInvoice::class]);
        $receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $sales      = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');

        Event::fake([SalesInvoiceGeneralLedgerPostingRequested::class]);

        $invoice = $this->makeSalesInvoice($receivable, $sales);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $this->assertCount(0, $this->ledgerOf($invoice), 'Listener ditahan: belum ada GL saat pembatalan.');

        app(SalesInvoiceService::class)->cancel($invoice->fresh());
        $this->assertContains(FormStatus::CANCELED, $invoice->fresh()->status);

        // Listener queued akhirnya berjalan dengan event yang sudah dibuat sebelum pembatalan.
        Event::assertDispatched(SalesInvoiceGeneralLedgerPostingRequested::class);
        $event = Event::dispatched(SalesInvoiceGeneralLedgerPostingRequested::class)->first()[0];
        (new PostSalesInvoiceGeneralLedger)->handle($event);

        // F-16 TERKONFIRMASI: dokumen `canceled` memiliki GL aktif.
        $active = GeneralLedger::where('referenceable_type', SalesInvoice::class)->where('referenceable_id', $invoice->id)->get();
        $this->assertCount(2, $active);
        $this->assertTrue($active->every(fn ($row) => $row->deleted_at === null));
        $this->assertContains(FormStatus::CANCELED, $invoice->fresh()->status);
        $this->assertPostingStatus($invoice, 'posted');

        // Auditor Fase 0 mendeteksi kondisi yang sama.
        $report = (new GeneralLedgerAuditor)->run();
        $this->assertSame(1, $report->sections['canceled_active_gl']['count']);
        $this->assertSame($invoice->id, $report->sections['canceled_active_gl']['samples'][0]['referenceable_id']);
    }
}
