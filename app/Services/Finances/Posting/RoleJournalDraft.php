<?php

namespace App\Services\Finances\Posting;

/**
 * Satu jurnal berperan hasil `PostingRule::build()` (Finance Fase 2, Requirement 4.2). `purpose` membentuk
 * `postingKey` `{sourceType}:{sourceId}:{purpose}` (kontrak Fase 1), jadi satu konteks yang menghasilkan beberapa
 * jurnal harus memberi `purpose` berbeda per jurnal. Bentuk ini menampung tiga baris atau lebih (baris pajak Fase 3).
 */
final readonly class RoleJournalDraft {
    /**
     * @param  list<RoleLine>  $lines
     */
    public function __construct(
        public string $purpose,
        public array $lines,
        public ?string $description = null,
    ) {}
}
