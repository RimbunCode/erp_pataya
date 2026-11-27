<?php

namespace App\Services\Finances\Posting;

use App\Services\Finances\Posting\Contexts\PostingContext;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * Titik masuk listener/service ke Posting Engine (Finance Fase 2, Requirement 6.2, 10.5-10.6). Listener tetap
 * memegang alur queue, transaksi, dan `GlPostingStatus`-nya; hanya bagian "tulis GL" yang dilewatkan ke sini.
 *
 * Keputusan pemilik produk 2026-11-22 (Q-P2-23, opsi A): mode `off`/`shadow` dihapus, engine selalu aktif untuk setiap
 * `PostingDocumentType`. Gateway hanya punya satu jalur tulis:
 *
 * 1. Guard cancel (F-16): dokumen penjaga (`guardDocument`, default sumber) `canceled` -> `GlPostingStatus` pending
 *    dokumen penjaga menjadi `skipped`, tidak ada jurnal, hasil `skipped`.
 * 2. Selain itu engine menulis. `UnresolvedAccountRoleException` dan sejenisnya dilempar ke pemanggil agar job gagal ke
 *    `GlPostingStatus=failed` (Requirement 7.6), tanpa fallback diam-diam.
 */
final class PostingGateway {
    public function __construct(
        private readonly PostingService $service,
        private readonly CanceledSourceGuard $guard,
    ) {}

    /**
     * Mengembalikan `PostingOutcome` (Q-P2-12): hasil `PostingService::post()` apa adanya, atau `skipped` bila
     * dokumen penjaga `canceled`.
     */
    public function post(PostingContext $ctx): PostingOutcome {
        return $this->postDeferred($ctx, fn (): PostingContext => $ctx);
    }

    /**
     * Seperti `post()`, tetapi konteks lengkap dibangun malas lewat `$context` dan HANYA bila dokumen penjaga tidak
     * `canceled` (pabrik konteks tidak dipanggil untuk dokumen yang dilewati). `$guardContext` hanya perlu memuat
     * jenis dokumen, sumber, dan dokumen penjaga untuk guard cancel.
     *
     * @param  Closure(): PostingContext  $context
     */
    public function postDeferred(PostingContext $guardContext, Closure $context): PostingOutcome {
        // Satu transaksi untuk guard dan engine: guard membaca dokumen penjaga dengan kunci baris
        // (transactionLevel >= 1) dan kunci itu bertahan sampai penulisan selesai. Di dalam transaksi listener ini
        // menjadi savepoint.
        return DB::transaction(function () use ($guardContext, $context): PostingOutcome {
            if ($this->guard->skipIfCanceled($guardContext)) {
                return PostingOutcome::skipped();
            }

            return $this->service->post($context(), checkCanceled: false);
        });
    }
}
