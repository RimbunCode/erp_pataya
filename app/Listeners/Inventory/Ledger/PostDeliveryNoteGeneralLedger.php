<?php

namespace App\Listeners\Inventory\Ledger;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostDeliveryNoteGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(DeliveryNoteGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $deliveryNote = $event->deliveryNote;

            $creditAccount = Account::lockForUpdate()
                ->where('root_type', 'asset')
                ->where('account_type', 'stock')
                ->latest()->first();

            $debitAccount = Account::lockForUpdate()
                ->where('root_type', 'income')
                ->where('account_type', 'cost_of_goods_sold')
                ->latest()->first();

            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'credit'             => $event->isReturn ? 0 : $event->totalPicked,
                'debit'              => $event->isReturn ? $event->totalPicked : 0,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $deliveryNote::class,
                'referenceable_id'   => $deliveryNote->id,
            ]);

            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'credit'             => $event->isReturn ? $event->totalPicked : 0,
                'debit'              => $event->isReturn ? 0 : $event->totalPicked,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $deliveryNote::class,
                'referenceable_id'   => $deliveryNote->id,
            ]);

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
