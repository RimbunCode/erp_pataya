<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Draft atau operasi jurnal tidak valid (struktur baris, akun, nilai di luar rentang, pembalikan yang tidak
 * diizinkan). Pesan berlokalisasi lewat `lang/{id,en}/finances/journal.php` (`errors.*`).
 */
class InvalidJournalException extends RuntimeException {
    public static function tooFewLines(int $count): self {
        return new self(__('finances/journal.errors.too_few_lines', ['count' => $count]));
    }

    public static function negativeAmount(int $lineNo): self {
        return new self(__('finances/journal.errors.negative_amount', ['line' => $lineNo]));
    }

    public static function bothSides(int $lineNo): self {
        return new self(__('finances/journal.errors.both_sides', ['line' => $lineNo]));
    }

    public static function noAmount(int $lineNo): self {
        return new self(__('finances/journal.errors.no_amount', ['line' => $lineNo]));
    }

    public static function nonNumericAmount(int $lineNo): self {
        return new self(__('finances/journal.errors.non_numeric_amount', ['line' => $lineNo]));
    }

    public static function amountOutOfRange(int $lineNo): self {
        return new self(__('finances/journal.errors.amount_out_of_range', ['line' => $lineNo]));
    }

    public static function accountNotFound(string $accountId): self {
        return new self(__('finances/journal.errors.account_not_found', ['account' => $accountId]));
    }

    public static function accountDeleted(string $accountLabel): self {
        return new self(__('finances/journal.errors.account_deleted', ['account' => $accountLabel]));
    }

    public static function accountIsGroup(string $accountLabel): self {
        return new self(__('finances/journal.errors.account_is_group', ['account' => $accountLabel]));
    }

    public static function accountDisabled(string $accountLabel): self {
        return new self(__('finances/journal.errors.account_disabled', ['account' => $accountLabel]));
    }

    public static function notReversible(string $status): self {
        return new self(__('finances/journal.errors.not_reversible', ['status' => $status]));
    }

    public static function reversalOfReversal(): self {
        return new self(__('finances/journal.errors.reversal_of_reversal'));
    }

    public static function legacyUnbalanced(): self {
        return new self(__('finances/journal.errors.legacy_unbalanced'));
    }

    public static function noActiveLines(): self {
        return new self(__('finances/journal.errors.no_active_lines'));
    }
}
