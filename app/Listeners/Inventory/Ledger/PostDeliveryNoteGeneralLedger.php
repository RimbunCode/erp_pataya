<?php

namespace App\Listeners\Inventory\Ledger;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Services\Finances\Ledger\JournalService;
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

            // Gateway Posting Engine (Finance Fase 2, Task 8.1): closure = jalur Fase 1 apa adanya (mode `off`/`shadow`).
            $outcome = app(PostingGateway::class)->post(
                app(DeliveryNotePostingContextFactory::class)->forPosting($deliveryNote, (float) $event->totalPicked, $event->isReturn, Carbon::instance($event->transactionDate)),
                function () use ($event, $deliveryNote) {
                    $creditAccount = Account::lockForUpdate()
                        ->where('root_type', 'asset')
                        ->where('account_type', 'stock')
                        ->latest()->first();

                    $debitAccount = Account::lockForUpdate()
                        ->where('root_type', 'income')
                        ->where('account_type', 'cost_of_goods_sold')
                        ->latest()->first();

                    try {
                        // Debit HPP, kredit stok; retur menukar sisi.
                        app(JournalService::class)->postPair(
                            $debitAccount->id,
                            $creditAccount->id,
                            $event->totalPicked,
                            $deliveryNote,
                            Carbon::instance($event->transactionDate),
                            reverseSides: $event->isReturn,
                        );
                    } catch (DuplicatePostingException) {
                        // Sudah terposting (Requirement 3.3).
                    }
                },
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
