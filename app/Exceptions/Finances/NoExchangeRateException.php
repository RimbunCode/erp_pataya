<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Tidak ada kurs untuk pasangan mata uang, tipe, dan tanggal yang diminta, baik tepat maupun terdekat sebelumnya
 * dalam batas umur (Finance Fase 4, Requirement 2.1). Gagal tertutup: tidak ada kurs tebakan. Pesan menyebut
 * pasangan, tipe, dan tanggal.
 */
class NoExchangeRateException extends RuntimeException {
    public function __construct(
        public readonly string $from,
        public readonly string $to,
        public readonly string $rateType,
        public readonly string $date,
    ) {
        parent::__construct(__('finances/exchangeRate.errors.no_rate', [
            'from' => $from,
            'to'   => $to,
            'type' => $rateType,
            'date' => $date,
        ]));
    }
}
