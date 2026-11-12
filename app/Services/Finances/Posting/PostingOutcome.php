<?php

namespace App\Services\Finances\Posting;

use App\Models\Finances\Journal;

/**
 * Hasil terstruktur `PostingService::post()` dan `PostingGateway::post()` (Finance Fase 2, Requirement 10.6; Q-P2-12).
 * Pemanggil (listener) wajib membedakan tiga keadaan:
 *
 * - `posted`: jurnal baru ditulis engine; atau jalur lama dijalankan gateway pada mode `off`/`shadow` (`journals`
 *   kosong karena jalur lama memegang jurnalnya sendiri); atau tidak ada jurnal yang perlu ditulis (jumlah nol).
 * - `already_posted`: seluruh jurnal konteks sudah ada (retry); efek samping non-idempoten tidak boleh diulang.
 * - `skipped`: dokumen penjaga `canceled`; tidak ada jurnal, `GlPostingStatus` penjaga menjadi `skipped`.
 */
final readonly class PostingOutcome {
    public const POSTED         = 'posted';
    public const ALREADY_POSTED = 'already_posted';
    public const SKIPPED        = 'skipped';

    /**
     * @param  list<Journal>  $journals
     */
    public function __construct(
        public string $status,
        public array $journals = [],
    ) {}

    /**
     * @param  list<Journal>  $journals
     */
    public static function posted(array $journals = []): self {
        return new self(self::POSTED, $journals);
    }

    /**
     * @param  list<Journal>  $journals
     */
    public static function alreadyPosted(array $journals): self {
        return new self(self::ALREADY_POSTED, $journals);
    }

    public static function skipped(): self {
        return new self(self::SKIPPED);
    }

    public function isPosted(): bool {
        return $this->status === self::POSTED;
    }

    public function isAlreadyPosted(): bool {
        return $this->status === self::ALREADY_POSTED;
    }

    public function isSkipped(): bool {
        return $this->status === self::SKIPPED;
    }
}
