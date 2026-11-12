<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Jenis dokumen posting tanpa `PostingRule` terdaftar (Finance Fase 2, Requirement 5.6): kesalahan pemrograman
 * (registry tidak lengkap), gagal keras.
 */
class UnknownPostingDocumentTypeException extends RuntimeException {
    public static function for(string $documentType): self {
        return new self(__('finances/posting.errors.unknown_document_type', ['type' => $documentType]));
    }
}
