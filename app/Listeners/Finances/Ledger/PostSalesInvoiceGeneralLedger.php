<?php

namespace App\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostSalesInvoiceGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(SalesInvoiceGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $salesInvoice = $event->salesInvoice;

            $debitAccount  = Account::where('id', $event->debitAccountId)->lockForUpdate()->firstOrFail();
            $creditAccount = Account::where('id', $event->creditAccountId)->lockForUpdate()->firstOrFail();

            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'credit'             => $event->isReturn ? 0 : $event->totalAmount,
                'debit'              => $event->isReturn ? $event->totalAmount : 0,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $salesInvoice::class,
                'referenceable_id'   => $salesInvoice->id,
            ]);

            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'credit'             => $event->isReturn ? $event->totalAmount : 0,
                'debit'              => $event->isReturn ? 0 : $event->totalAmount,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $salesInvoice::class,
                'referenceable_id'   => $salesInvoice->id,
            ]);

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
