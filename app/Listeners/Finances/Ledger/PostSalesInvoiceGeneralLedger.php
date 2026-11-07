<?php

namespace App\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
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

class PostSalesInvoiceGeneralLedger implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(SalesInvoiceGeneralLedgerPostingRequested $event): void {
        DB::transaction(function () use ($event) {
            $salesInvoice = $event->salesInvoice;

            $debitAccount  = Account::where('id', $event->debitAccountId)->lockForUpdate()->firstOrFail();
            $creditAccount = Account::where('id', $event->creditAccountId)->lockForUpdate()->firstOrFail();

            try {
                // Requirement 8.1: satu jurnal dua baris lewat JournalService; retur menukar sisi. Jumlah nol tidak
                // lagi membuat baris 0/0 (Requirement 2.10, N-8).
                app(JournalService::class)->postPair(
                    $debitAccount->id,
                    $creditAccount->id,
                    $event->totalAmount,
                    $salesInvoice,
                    Carbon::instance($event->transactionDate),
                    reverseSides: $event->isReturn,
                );
            } catch (DuplicatePostingException) {
                // Retry atas posting yang sudah berhasil: perlakukan sebagai sudah terposting (Requirement 3.3).
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
