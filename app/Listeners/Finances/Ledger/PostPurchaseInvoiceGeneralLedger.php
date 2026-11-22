<?php

namespace App\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Services\Finances\Accounting\PurchaseInvoicePostingContextFactory;
use App\Services\Finances\Posting\PostingGateway;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostPurchaseInvoiceGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(PurchaseInvoiceGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $purchaseInvoice = $event->purchaseInvoice;
            $transactionDate = Carbon::instance($event->transactionDate);

            // Gateway Posting Engine (Finance Fase 2, Task 8.2; closure legacy dihapus Task 14.1): akun datang dari peran
            // profil. Dua jurnal (`stock` dan `expense`) ditulis satu konteks; `PostingService::post()` atomik untuk keduanya.
            // `PostingModeNotOnException`/`UnresolvedAccountRoleException` membuat job gagal ke `failed`.
            $outcome = app(PostingGateway::class)->postDeferred(
                app(PurchaseInvoicePostingContextFactory::class)->forGuard($purchaseInvoice, $transactionDate),
                fn () => app(PurchaseInvoicePostingContextFactory::class)->forPosting($purchaseInvoice, (float) $event->totalStockGL, (float) $event->totalAmount, $event->isReturn, $transactionDate),
            );

            // Q-P2-12: jangan menimpa `skipped` (dokumen dibatalkan sebelum job berjalan) menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
            }

            GlPostingStatus::where('referenceable_type', $purchaseInvoice::class)
                ->where('referenceable_id', $purchaseInvoice->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });
    }

    public function failed(PurchaseInvoiceGeneralLedgerPostingRequested $event, Throwable $e): void {
        $purchaseInvoice = $event->purchaseInvoice;

        GlPostingStatus::where('referenceable_type', $purchaseInvoice::class)
            ->where('referenceable_id', $purchaseInvoice->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }
}
