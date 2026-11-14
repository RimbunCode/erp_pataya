<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Audit\GeneralLedgerAuditor;
use App\Services\Finances\SalesInvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * F-16 (PRD Lampiran A): dokumen dibatalkan sebelum listener posting yang di-queue berjalan.
 * Hook cancel (F-04) tidak menemukan baris GL untuk di-soft-delete. Test menahan listener dengan `Event::fake` lalu
 * menjalankannya setelah pembatalan.
 *
 * Diperbarui Finance Fase 2 Sprint D (Task 8.2; Requirement 10.5, P-6): listener kini memanggil `PostingGateway`
 * yang memeriksa dokumen penjaga pada SEMUA mode (termasuk `off`). Sebelum itu test ini mengunci bug (GL aktif untuk
 * dokumen `canceled`); kini mengunci perbaikannya: tidak ada GL, `GlPostingStatus` `skipped`, auditor bersih.
 */
class CancelBeforeQueuedPostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    public function test_f16_listener_running_after_cancel_is_skipped_by_the_gateway_guard(): void {
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

        // Guard gateway (mode `off`, jalur lama): dokumen `canceled` tidak diposting dan statusnya `skipped`.
        $this->assertCount(0, GeneralLedger::withTrashed()->where('referenceable_type', SalesInvoice::class)->where('referenceable_id', $invoice->id)->get());
        $this->assertContains(FormStatus::CANCELED, $invoice->fresh()->status);
        $this->assertPostingStatus($invoice, 'skipped');

        // Auditor Fase 0 tidak lagi menemukan GL aktif untuk dokumen `canceled`.
        $report = (new GeneralLedgerAuditor)->run();
        $this->assertSame(0, $report->sections['canceled_active_gl']['count']);
    }
}
