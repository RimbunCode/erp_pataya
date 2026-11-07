<?php

namespace App\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Services\Finances\Ledger\JournalService;
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

                // Dua jurnal terpisah per invoice dengan `purpose` berbeda (Requirement 8.1): `stock` dan `expense`.
                try {
                    app(JournalService::class)->postPair(
                        $stockAccount->id,
                        $srnbAccount->id,
                        $event->totalStockGL,
                        $purchaseInvoice,
                        $transactionDate,
                        purpose: 'stock',
                    );
                } catch (DuplicatePostingException) {
                    // Sudah terposting (Requirement 3.3).
                }
            }

            // === GL Expense/Credit (selalu dibuat) — akun spesifik invoice ini, BUKAN query generik ===
            $debitAccount  = Account::where('id', $event->expenseHeadAccountId)->lockForUpdate()->firstOrFail();
            $creditAccount = Account::where('id', $event->creditAccountId)->lockForUpdate()->firstOrFail();

            try {
                app(JournalService::class)->postPair(
                    $debitAccount->id,
                    $creditAccount->id,
                    $event->totalAmount,
                    $purchaseInvoice,
                    $transactionDate,
                    purpose: 'expense',
                    reverseSides: $event->isReturn,
                );
            } catch (DuplicatePostingException) {
                // Sudah terposting (Requirement 3.3).
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
