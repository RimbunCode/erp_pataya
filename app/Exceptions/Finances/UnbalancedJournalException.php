<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Σdebit ≠ Σkredit dalam satuan minor unit mata uang dasar (Requirement 2.5). Membawa selisih (debit − kredit).
 */
class UnbalancedJournalException extends RuntimeException {
    public function __construct(
        public readonly int $differenceMinor,
        public readonly int $minorUnit,
        string $message,
    ) {
        parent::__construct($message);
    }

    public static function make(int $differenceMinor, int $minorUnit): self {
        $difference = number_format($differenceMinor / (10 ** $minorUnit), $minorUnit, '.', '');

        return new self(
            $differenceMinor,
            $minorUnit,
            __('finances/journal.errors.unbalanced', ['difference' => $difference]),
        );
    }
}
