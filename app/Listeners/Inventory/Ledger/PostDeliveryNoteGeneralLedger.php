<?php

namespace App\Listeners\Inventory\Ledger;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Inventory\Accounting\DeliveryNotePostingContextFactory;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostDeliveryNoteGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(DeliveryNoteGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $deliveryNote = $event->deliveryNote;

            // Gateway Posting Engine (Finance Fase 2, Task 8.1; closure legacy dihapus Task 14.1): akun datang dari
            // peran profil (debit HPP, kredit stok; retur menukar sisi lewat rule), dan
            // `UnresolvedAccountRoleException` membuat job gagal ke `failed`.
            $outcome = app(PostingGateway::class)->post(
                app(DeliveryNotePostingContextFactory::class)->forPosting($deliveryNote, (float) $event->totalPicked, $event->isReturn, Carbon::instance($event->transactionDate)),
            );

            // Q-P2-12: jangan menimpa `skipped` (dokumen dibatalkan sebelum job berjalan) menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
            }

            GlPostingStatus::where('referenceable_type', $deliveryNote::class)
                ->where('referenceable_id', $deliveryNote->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });
    }

    public function failed(DeliveryNoteGeneralLedgerPostingRequested $event, Throwable $e): void {
        $deliveryNote = $event->deliveryNote;

        GlPostingStatus::where('referenceable_type', $deliveryNote::class)
            ->where('referenceable_id', $deliveryNote->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }
}
