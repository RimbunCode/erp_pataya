<?php

namespace App\Services\Finances\Posting;

use App\Models\Finances\FinanceSetting;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Closure;
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
        // Satu transaksi untuk guard, jalur lama, dan engine: guard membaca dokumen penjaga dengan kunci baris
        // (transactionLevel >= 1) dan kunci itu bertahan sampai penulisan selesai. Di dalam transaksi listener ini
        // menjadi savepoint. Kegagalan engine pada `shadow` ditelan di savepoint sendiri sehingga tidak menggulung
        // jalur lama; pengecualian jalur lama dan mode `on` menggulung transaksi seperti sebelumnya.
        return DB::transaction(function () use ($ctx, $legacy): PostingOutcome {
            if ($this->guard->skipIfCanceled($ctx)) {
                return PostingOutcome::skipped();
            }

            switch ($this->modes->for($ctx->documentType)) {
                case FinanceSetting::POSTING_MODE_ON:
                    return $this->service->post($ctx, checkCanceled: false);
                case FinanceSetting::POSTING_MODE_SHADOW:
                    $this->shadow($ctx, $legacy);

                    return PostingOutcome::posted();
                default:
                    $legacy();

                    return PostingOutcome::posted();
            }
        });
    }

    /**
     * @param  Closure(): void  $legacy
     */
    private function shadow(PostingContext $ctx, Closure $legacy): void {
        $legacy();

        try {
            // Savepoint: kegagalan query engine tidak boleh meracuni transaksi listener yang sedang berjalan.
            DB::transaction(fn () => $this->comparator->record($ctx, $this->service->preview($ctx), $this->service->purposes($ctx)));
        } catch (Throwable $error) {
            Log::warning('posting.shadow_engine_error', [
                'document_type' => $ctx->documentType->value,
                'source_type'   => $ctx->sourceType,
                'source_id'     => $ctx->sourceId,
                'error'         => $error->getMessage(),
            ]);

            try {
                DB::transaction(fn () => $this->comparator->recordEngineError($ctx, $error, $this->safePurposes($ctx)));
            } catch (Throwable $logError) {
                Log::warning('posting.shadow_log_failed', ['error' => $logError->getMessage()]);
            }
        }
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
