<?php

namespace App\Exceptions\Finances;

use App\Enums\PostingDocumentType;
use RuntimeException;

/**
 * Jenis dokumen diposting saat mode Posting Engine-nya bukan `on` (Finance Fase 2, Task 14.1). Sejak closure legacy
 * dihapus, mode `off`/`shadow` tidak lagi punya jalur posting: gateway gagal tertutup (tanpa jurnal, tanpa fallback
 * diam-diam ke akun lama) sehingga job posting gagal ke `GlPostingStatus=failed` dan approve sinkron digulung dengan
 * pesan yang jelas. Pesan berlokalisasi lewat `lang/{id,en}/finances/posting.php`.
 */
class PostingModeNotOnException extends RuntimeException {
    public function __construct(
        public readonly string $documentType,
        public readonly string $mode,
    ) {
        parent::__construct(__('finances/posting.errors.mode_not_on', [
            'document' => $documentType,
            'mode'     => $mode,
        ]));
    }

    public static function for(PostingDocumentType $type, string $mode): self {
        return new self($type->value, $mode);
    }
}
