<?php

namespace App\Services\Finances\Posting;

use App\Exceptions\Finances\PostingModeNotOnException;
use App\Models\Finances\FinanceSetting;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * Titik masuk listener/service ke Posting Engine (Finance Fase 2, Requirement 6.2-6.4, 10.5-10.6). Listener tetap
 * memegang alur queue, transaksi, dan `GlPostingStatus`-nya; hanya bagian "tulis GL" yang dilewatkan ke sini.
 *
 * Sejak Task 14.1 (keputusan pemilik produk 2026-11-21; semua jenis dokumen dikonfirmasi `on` 2026-11-22) closure
 * legacy (jalur Fase 1 `postPair`) sudah dihapus dari seluruh pemanggil, sehingga gateway hanya punya satu jalur tulis:
 *
 * 1. Guard cancel (F-16), pada semua mode: dokumen penjaga (`guardDocument`, default sumber) `canceled` ->
 *    `GlPostingStatus` pending dokumen penjaga menjadi `skipped`, tidak ada jurnal, hasil `skipped`.
 * 2. `on`: engine menulis. `UnresolvedAccountRoleException` dan sejenisnya dilempar ke pemanggil agar job gagal ke
 *    `GlPostingStatus=failed` (Requirement 7.6), tanpa fallback diam-diam.
 * 3. `off`/`shadow`: tidak ada lagi jalur lama. Gateway gagal tertutup dengan `PostingModeNotOnException` SEBELUM
 *    pabrik konteks dipanggil: tidak ada jurnal dan tidak ada akun lama yang dipakai diam-diam. Ini perilaku sementara
 *    yang paling konservatif sampai pemilik produk memutuskan nasib mode `off`/`shadow` dan default mode (pertanyaan
 *    terbuka Q-P2-23).
 */
final class PostingGateway {
    public function __construct(
        private readonly PostingModeResolver $modes,
        private readonly PostingService $service,
        private readonly CanceledSourceGuard $guard,
    ) {}

    /**
     * Mengembalikan `PostingOutcome` (Q-P2-12): hasil `PostingService::post()` apa adanya pada `on`, atau `skipped`
     * pada semua mode bila dokumen penjaga `canceled`.
     *
     * @throws PostingModeNotOnException bila mode jenis dokumen bukan `on` dan dokumen penjaga tidak `canceled`
     */
    public function post(PostingContext $ctx): PostingOutcome {
        return $this->postDeferred($ctx, fn (): PostingContext => $ctx);
    }

    /**
     * Seperti `post()`, tetapi konteks lengkap dibangun malas lewat `$context` dan HANYA bila mode jenis dokumen `on`
     * (pabrik konteks tidak dipanggil pada mode lain). `$guardContext` hanya perlu memuat jenis dokumen, sumber, dan
     * dokumen penjaga untuk guard cancel.
     *
     * @param  Closure(): PostingContext  $context
     *
     * @throws PostingModeNotOnException
     */
    public function postDeferred(PostingContext $guardContext, Closure $context): PostingOutcome {
        // Satu transaksi untuk guard dan engine: guard membaca dokumen penjaga dengan kunci baris
        // (transactionLevel >= 1) dan kunci itu bertahan sampai penulisan selesai. Di dalam transaksi listener ini
        // menjadi savepoint.
        return DB::transaction(function () use ($guardContext, $context): PostingOutcome {
            if ($this->guard->skipIfCanceled($guardContext)) {
                return PostingOutcome::skipped();
            }

            $mode = $this->modes->for($guardContext->documentType);
            if ($mode !== FinanceSetting::POSTING_MODE_ON) {
                throw PostingModeNotOnException::for($guardContext->documentType, $mode);
            }

            return $this->service->post($context(), checkCanceled: false);
        });
    }
}
