<?php

namespace App\Listeners\Purchase\Ledger;

use App\Enums\FormStatus;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Purchase\Accounting\PurchaseReceiptPostingContextFactory;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostPurchaseReceiptGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(PurchaseReceiptGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $purchaseReceipt = $event->purchaseReceipt;

            // Gateway Posting Engine (Finance Fase 2, Task 8.1; closure legacy dihapus Task 14.1): akun datang dari
            // peran profil, dan `UnresolvedAccountRoleException` membuat job gagal ke `failed`.
            $outcome = app(PostingGateway::class)->post(
                app(PurchaseReceiptPostingContextFactory::class)->forPosting($purchaseReceipt, (float) $event->totalRatesForGL, $event->isReturn, Carbon::instance($event->transactionDate)),
            );

            // Q-P2-12: jangan menimpa `skipped` (dokumen dibatalkan sebelum job berjalan) menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
            }

            GlPostingStatus::where('referenceable_type', $purchaseReceipt::class)
                ->where('referenceable_id', $purchaseReceipt->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });
    }

    public function failed(PurchaseReceiptGeneralLedgerPostingRequested $event, Throwable $e): void {
        $purchaseReceipt = $event->purchaseReceipt;

        GlPostingStatus::where('referenceable_type', $purchaseReceipt::class)
            ->where('referenceable_id', $purchaseReceipt->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }
}
