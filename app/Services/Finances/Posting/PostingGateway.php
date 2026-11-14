<?php

namespace App\Services\Finances\Posting;

use App\Models\Finances\FinanceSetting;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Closure;
use Illuminate\Contracts\Database\ConcurrencyErrorDetector;
use Illuminate\Contracts\Database\LostConnectionDetector;
use Illuminate\Database\DeadlockException;
use Illuminate\Database\LostConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Titik masuk listener/service ke Posting Engine (Finance Fase 2, Requirement 6.2-6.4, 10.5-10.6). Listener tetap
 * memegang alur queue, transaksi, dan `GlPostingStatus`-nya; hanya bagian "tulis GL" yang dilewatkan ke sini.
 *
 * 1. Guard cancel (F-16), pada semua mode: dokumen penjaga (`guardDocument`, default sumber) `canceled` ->
 *    `GlPostingStatus` pending dokumen penjaga menjadi `skipped`, tidak ada jurnal, `$legacy` tidak dijalankan,
 *    hasil `skipped`.
 * 2. `off`: hanya jalur lama (`$legacy`); engine tidak dipanggil sama sekali (P-5).
 * 3. `shadow`: jalur lama menulis, lalu engine `preview()` dibandingkan dengan jurnal yang baru ditulis dan dicatat
 *    di `posting_parity_logs`. Kegagalan engine ditelan (dicatat `engine_error`) dan tidak menggagalkan posting lama.
 * 4. `on`: engine menulis; jalur lama tidak dipakai. `UnresolvedAccountRoleException` dan sejenisnya dilempar ke
 *    pemanggil agar job gagal ke `GlPostingStatus=failed` (Requirement 7.6), tanpa fallback diam-diam.
 */
final class PostingGateway {
    public function __construct(
        private readonly PostingModeResolver $modes,
        private readonly PostingService $service,
        private readonly ParityComparator $comparator,
        private readonly CanceledSourceGuard $guard,
    ) {}

    /**
     * @param  Closure(): void  $legacy  jalur lama (Fase 1, `postPair`) milik listener
     *
     * Mengembalikan `PostingOutcome` (Q-P2-12). `off`/`shadow`: `posted` tanpa `journals` (jalur lama memegang
     * jurnalnya; gateway tidak tahu apakah jalur lama menemukan duplikat). `on`: hasil `PostingService::post()`
     * apa adanya. `skipped` pada semua mode bila dokumen penjaga `canceled`.
     */
    public function post(PostingContext $ctx, Closure $legacy): PostingOutcome {
        return $this->postDeferred($ctx, fn (): PostingContext => $ctx, $legacy);
    }

    /**
     * Seperti `post()`, tetapi konteks lengkap dibangun malas lewat `$context` dan HANYA bila mode jenis dokumen bukan
     * `off` (Requirement 6.2: pada `off` jalur lama berjalan seperti sekarang, tanpa pekerjaan pabrik konteks).
     * `$guardContext` hanya perlu memuat jenis dokumen, sumber, dan dokumen penjaga untuk guard cancel.
     *
     * @param  Closure(): PostingContext  $context
     * @param  Closure(): void  $legacy
     */
    public function postDeferred(PostingContext $guardContext, Closure $context, Closure $legacy): PostingOutcome {
        // Satu transaksi untuk guard, jalur lama, dan engine: guard membaca dokumen penjaga dengan kunci baris
        // (transactionLevel >= 1) dan kunci itu bertahan sampai penulisan selesai. Di dalam transaksi listener ini
        // menjadi savepoint. Kegagalan engine pada `shadow` ditelan di savepoint sendiri sehingga tidak menggulung
        // jalur lama; pengecualian jalur lama dan mode `on` menggulung transaksi seperti sebelumnya.
        return DB::transaction(function () use ($guardContext, $context, $legacy): PostingOutcome {
            if ($this->guard->skipIfCanceled($guardContext)) {
                return PostingOutcome::skipped();
            }

            switch ($this->modes->for($guardContext->documentType)) {
                case FinanceSetting::POSTING_MODE_ON:
                    return $this->service->post($context(), checkCanceled: false);
                case FinanceSetting::POSTING_MODE_SHADOW:
                    $this->shadow($guardContext, $context, $legacy);

                    return PostingOutcome::posted();
                default:
                    $legacy();

                    return PostingOutcome::posted();
            }
        });
    }

    /**
     * Konteks lengkap dibangun SETELAH jalur lama berjalan dan di dalam savepoint penelan: exception pabrik konteks
     * (non-konkurensi) tidak boleh menggagalkan posting lama; ia dicatat sebagai `engine_error` memakai konteks penjaga
     * (jenis dokumen dan sumber yang sama).
     *
     * @param  Closure(): PostingContext  $context
     * @param  Closure(): void  $legacy
     */
    private function shadow(PostingContext $guardContext, Closure $context, Closure $legacy): void {
        $legacy();

        $ctx = null;
        // Level transaksi sebelum savepoint: bila turun setelah kegagalan, koneksi sudah direset dan server menggulung
        // SELURUH transaksi (jurnal jalur lama ikut hilang) walau error-nya tidak tampak sebagai error konkurensi.
        $level = DB::transactionLevel();

        try {
            // Savepoint: kegagalan query engine tidak boleh meracuni transaksi listener yang sedang berjalan.
            DB::transaction(function () use ($context, &$ctx): void {
                $ctx = $context();
                $this->comparator->record($ctx, $this->service->preview($ctx), $this->service->purposes($ctx));
            });
        } catch (Throwable $error) {
            // Error konkurensi (deadlock, lock wait timeout): Laravel hanya menurunkan counter transaksi bersarang tanpa
            // ROLLBACK TO SAVEPOINT, sehingga menelannya akan meng-commit tulisan engine yang parsial dan menyembunyikan
            // error pada jalur sinkron; deadlock (1213) juga menggulung seluruh transaksi termasuk jurnal jalur lama.
            // Dilempar ulang agar job gagal/di-retry (Q-P2-21).
            if ($this->mustRethrow($error, $level)) {
                throw $error;
            }

            $logCtx = $ctx ?? $guardContext;

            Log::warning('posting.shadow_engine_error', [
                'document_type' => $logCtx->documentType->value,
                'source_type'   => $logCtx->sourceType,
                'source_id'     => $logCtx->sourceId,
                'error'         => $error->getMessage(),
            ]);

            try {
                DB::transaction(fn () => $this->comparator->recordEngineError($logCtx, $error, $ctx === null ? null : $this->safePurposes($ctx)));
            } catch (Throwable $logError) {
                // Insert `engine_error` bisa bentrok dengan `finance:prune-parity-logs`: error konkurensi tetap dilempar ulang
                // agar listener tidak menulis POSTED tanpa jurnal (celah yang sama dengan Q-P2-21); error log biasa ditelan.
                if ($this->mustRethrow($logError, $level)) {
                    throw $logError;
                }

                Log::warning('posting.shadow_log_failed', ['error' => $logError->getMessage()]);
            }
        }
    }

    /**
     * Error yang tidak boleh ditelan di `shadow` (Q-P2-21, diperluas 2026-11-14): konkurensi, koneksi putus
     * (`LostConnectionException` atau terdeteksi `LostConnectionDetector`), atau level transaksi turun di bawah level awal
     * (koneksi direset saat savepoint/rollback gagal; server menggulung seluruh transaksi).
     */
    private function mustRethrow(Throwable $error, int $level): bool {
        return $this->isConcurrencyError($error)
            || $error instanceof LostConnectionException
            || app(LostConnectionDetector::class)->causedByLostConnection($error)
            || DB::transactionLevel() < $level;
    }

    private function isConcurrencyError(Throwable $error): bool {
        return $error instanceof DeadlockException || app(ConcurrencyErrorDetector::class)->causedByConcurrencyError($error);
    }

    /**
     * @return list<string>|null null bila rule gagal (tanpa penyaringan purpose pada log kegagalan)
     */
    private function safePurposes(PostingContext $ctx): ?array {
        try {
            return $this->service->purposes($ctx);
        } catch (Throwable) {
            return null;
        }
    }
}
