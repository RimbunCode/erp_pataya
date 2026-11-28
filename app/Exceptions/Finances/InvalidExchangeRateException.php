<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Input kurs ditolak validasi (Finance Fase 4, Requirement 1.2): `from = to`, `rate <= 0`, kode mata uang tidak ada,
 * tipe/tanggal tidak valid. `$errors` memetakan nama kolom ke pesan.
 */
class InvalidExchangeRateException extends RuntimeException {
    /**
     * @param  array<string, string>  $errors
     */
    public function __construct(public readonly array $errors) {
        parent::__construct(implode(' ', $errors));
    }
}
