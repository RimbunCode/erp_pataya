<?php

namespace App\Exceptions\Finances;

/**
 * Jurnal sudah dibalik atau sudah berstatus void (Requirement 5.4).
 */
class JournalAlreadyReversedException extends InvalidJournalException {
    public static function make(string $journalCode): self {
        return new self(__('finances/journal.errors.already_reversed', ['code' => $journalCode]));
    }
}
