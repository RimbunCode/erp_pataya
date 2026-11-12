<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;

/**
 * Strategi per jenis dokumen yang mengubah `PostingContext` menjadi jurnal berperan (Finance Fase 2, Requirement
 * 4.2-4.3). Implementasi harus murni: tanpa akses DB atau efek samping, supaya dapat diuji tanpa database dan
 * dipakai mode `shadow` (Requirement 4.6, P-2).
 */
interface PostingRule {
    public function documentType(): PostingDocumentType;

    /**
     * @return list<RoleJournalDraft>
     */
    public function build(PostingContext $ctx): array;
}
