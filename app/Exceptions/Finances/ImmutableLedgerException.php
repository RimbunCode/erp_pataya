<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Upaya mengubah atau menghapus jurnal/baris jurnal terposting lewat model (Requirement 4.1-4.3). Guard ini
 * melindungi dari penggunaan ORM yang tidak disengaja, bukan dari SQL langsung (Requirement 4.4, D-7).
 */
class ImmutableLedgerException extends RuntimeException {
    public static function line(): self {
        return new self(__('finances/journal.errors.immutable_line'));
    }

    public static function journal(): self {
        return new self(__('finances/journal.errors.immutable_journal'));
    }
}
