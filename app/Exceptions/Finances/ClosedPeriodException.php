<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Posting ke periode fiskal yang `closed` atau tidak terdefinisi saat penegakan aktif (Requirement 6.5).
 */
class ClosedPeriodException extends RuntimeException {
    public static function closed(string $periodName, string $date): self {
        return new self(__('finances/journal.errors.period_closed', ['period' => $periodName, 'date' => $date]));
    }

    public static function notDefined(string $date): self {
        return new self(__('finances/journal.errors.period_not_defined', ['date' => $date]));
    }
}
