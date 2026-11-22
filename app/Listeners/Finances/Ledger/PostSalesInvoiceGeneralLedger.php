<?php

namespace App\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Sales\Accounting\SalesInvoicePostingContextFactory;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostSalesInvoiceGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(SalesInvoiceGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $salesInvoice = $event->salesInvoice;

            // Gateway Posting Engine (Finance Fase 2, Task 8.2; closure legacy dihapus Task 14.1): akun datang dari peran
            // profil (retur menukar sisi lewat rule), dan `UnresolvedAccountRoleException`
            // membuat job gagal ke `failed`. Konteks lengkap hanya dibangun bila dokumen tidak `canceled`.
            $outcome = app(PostingGateway::class)->postDeferred(
                app(SalesInvoicePostingContextFactory::class)->forGuard($salesInvoice, Carbon::instance($event->transactionDate)),
                fn () => app(SalesInvoicePostingContextFactory::class)->forPosting($salesInvoice, (float) $event->totalAmount, $event->isReturn, Carbon::instance($event->transactionDate)),
            );

            // Q-P2-12: jangan menimpa `skipped` (dokumen dibatalkan sebelum job berjalan) menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
            }

            GlPostingStatus::where('referenceable_type', $salesInvoice::class)
                ->where('referenceable_id', $salesInvoice->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });
    }

    public function failed(SalesInvoiceGeneralLedgerPostingRequested $event, Throwable $e): void {
        $salesInvoice = $event->salesInvoice;

        GlPostingStatus::where('referenceable_type', $salesInvoice::class)
            ->where('referenceable_id', $salesInvoice->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }
}
