<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Upaya mengubah atau menghapus kurs yang sudah dirujuk transaksi (Finance Fase 4, Requirement 1.3). Koreksi
 * dilakukan dengan kurs pada tipe atau tanggal berbeda.
 */
class ImmutableRateException extends RuntimeException {
    public static function referenced(): self {
        return new self(__('finances/exchangeRate.errors.immutable_referenced'));
    }
}
