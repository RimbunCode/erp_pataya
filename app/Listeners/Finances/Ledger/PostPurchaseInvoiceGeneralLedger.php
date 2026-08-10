<?php

namespace App\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostPurchaseInvoiceGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(PurchaseInvoiceGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $purchaseInvoice = $event->purchaseInvoice;

            // === GL Stock/SRNB (kondisional: hanya jika $totalStockGL > 0) ===
            if ($event->totalStockGL > 0 && ! $event->isReturn) {
                $stockAccount = Account::lockForUpdate()
                    ->where('root_type', 'asset')
                    ->where('account_type', 'stock')
                    ->latest()->first();

                $srnbAccount = Account::lockForUpdate()
                    ->where('root_type', 'liability')
                    ->where('account_type', 'stock_received_but_not_billed')
                    ->latest()->first();

                $stockAccount->generalLedgerEntries()->create([
                    'against_account_id' => $srnbAccount->id,
                    'debit'              => $event->totalStockGL,
                    'credit'             => 0,
                    'transaction_date'   => $event->transactionDate,
                    'referenceable_type' => $purchaseInvoice::class,
                    'referenceable_id'   => $purchaseInvoice->id,
                ]);

                $srnbAccount->generalLedgerEntries()->create([
                    'against_account_id' => $stockAccount->id,
                    'debit'              => 0,
                    'credit'             => $event->totalStockGL,
                    'transaction_date'   => $event->transactionDate,
                    'referenceable_type' => $purchaseInvoice::class,
                    'referenceable_id'   => $purchaseInvoice->id,
                ]);
            }

            // === GL Expense/Credit (selalu dibuat) — akun spesifik invoice ini, BUKAN query generik ===
            $debitAccount  = Account::where('id', $event->expenseHeadAccountId)->lockForUpdate()->firstOrFail();
            $creditAccount = Account::where('id', $event->creditAccountId)->lockForUpdate()->firstOrFail();

            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'debit'              => $event->isReturn ? 0 : $event->totalAmount,
                'credit'             => $event->isReturn ? $event->totalAmount : 0,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $purchaseInvoice::class,
                'referenceable_id'   => $purchaseInvoice->id,
            ]);

            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'debit'              => $event->isReturn ? $event->totalAmount : 0,
                'credit'             => $event->isReturn ? 0 : $event->totalAmount,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => $purchaseInvoice::class,
                'referenceable_id'   => $purchaseInvoice->id,
            ]);

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
