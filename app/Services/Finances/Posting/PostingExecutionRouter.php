<?php

namespace App\Services\Finances\Posting;

use App\Enums\PostingDocumentType;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Menjalankan listener posting GL inline atau berantrean menurut setting `posting_executions` (Finance Fase 2,
 * Requirement 9; D-1 opsi C, 2026-11-21). `inline` (default): listener dipanggil sinkron di titik `event(...)`,
 * yaitu di dalam transaksi dokumen sumber, sehingga kegagalan posting membatalkan dokumen (Requirement 9.3).
 * `queue`: listener diantrekan seperti sebelumnya (`tries`, `backoff`, dan `failed()` listener tetap berlaku).
 *
 * Bila inline dijalankan di luar transaksi apa pun (mis. scrap aset yang memanggil event setelah commit), tidak ada
 * transaksi dokumen yang dapat digulung: kegagalan dicatat lewat `failed()` listener (status `failed`, dapat dicoba ulang
 * dari Status Posting GL) seperti pada jalur antrean, bukan dilempar ke pengguna.
 *
 * Catatan: `shouldQueue()` pada listener `ShouldQueue` tidak dapat dipakai untuk ini, karena listener yang
 * `shouldQueue()`-nya `false` tidak dijalankan sama sekali.
 */
final class PostingExecutionRouter {
    /**
     * @param  int  $outerTransactionLevel  kedalaman transaksi "kosong" (0 di produksi; tes di dalam `RefreshDatabase`
     *                                      memberi kedalaman awalnya)
     */
    public function __construct(
        private readonly PostingExecutionResolver $resolver,
        private readonly int $outerTransactionLevel = 0,
    ) {}

    /**
     * @param  class-string  $listener
     */
    public function route(string $listener, PostingDocumentType $type, object $event): void {
        $instance = app($listener);

        if (! $this->resolver->isQueued($type)) {
            $this->runInline($instance, $event);

            return;
        }

        $job = new CallQueuedListener($listener, 'handle', [$event]);
        if (property_exists($instance, 'tries')) {
            $job->tries = $instance->tries;
        }
        if (property_exists($instance, 'backoff')) {
            $job->backoff = $instance->backoff;
        }

        dispatch($job);
    }

    private function runInline(object $listener, object $event): void {
        try {
            $listener->handle($event);
        } catch (Throwable $e) {
            if (DB::transactionLevel() > $this->outerTransactionLevel) {
                throw $e; // ada transaksi dokumen: gulung seluruhnya (Requirement 9.3)
            }

            report($e);
            if (method_exists($listener, 'failed')) {
                $listener->failed($event, $e);
            }
        }
    }
}
