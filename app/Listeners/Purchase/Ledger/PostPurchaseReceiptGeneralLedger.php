<?php

namespace App\Listeners\Purchase\Ledger;

use App\Enums\FormStatus;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostPurchaseReceiptGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(PurchaseReceiptGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $purchaseReceipt = $event->purchaseReceipt;

            $debitAccount = Account::lockForUpdate()
                ->where('root_type', 'asset')
                ->where('account_type', 'stock')
                ->latest()->first();

            $creditAccount = Account::lockForUpdate()
                ->where('root_type', 'liability')
                ->where('account_type', 'stock_received_but_not_billed')
                ->latest()->first();

            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'credit'             => $event->isReturn ? 0 : $event->totalRatesForGL,
                'debit'              => $event->isReturn ? $event->totalRatesForGL : 0,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $purchaseReceipt::class,
                'referenceable_id'   => $purchaseReceipt->id,
            ]);

            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'credit'             => $event->isReturn ? $event->totalRatesForGL : 0,
                'debit'              => $event->isReturn ? 0 : $event->totalRatesForGL,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $purchaseReceipt::class,
                'referenceable_id'   => $purchaseReceipt->id,
            ]);

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
