<?php

namespace App\Services\Finances\Ledger;

/**
 * Baris draft setelah divalidasi dan dibulatkan ke minor unit (hasil `JournalDraftValidator`).
 */
final readonly class NormalizedLine {
    public function __construct(
        public JournalLineDraft $draft,
        public int $lineNo,
        public int $debitMinor,
        public int $creditMinor,
    ) {}
}
