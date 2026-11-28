<?php

namespace App\Services\Finances\Currency\Providers;

/**
 * Sumber kurs (Finance Fase 4, Requirement 1.4). Fase ini hanya menyediakan penyedia tanpa jaringan
 * (`ManualProvider`, `CsvImportProvider`); penyedia API ditambahkan kemudian lewat antarmuka yang sama.
 */
interface ExchangeRateProvider {
    /** Nilai kolom `exchange_rates.source` yang ditulis penyedia ini. */
    public function source(): string;

    /**
     * Mencatat baris kurs. Setiap baris divalidasi sendiri; baris galat dilaporkan dan tidak menghentikan baris lain.
     *
     * @param  iterable<int, array<string, mixed>>  $rows  kunci = nomor baris sumber (untuk laporan galat); isi memuat
     *                                                     `from_currency_code`, `to_currency_code`, `rate_type`, `rate`, `rate_date`
     */
    public function ingest(iterable $rows, ?string $sourceRef = null, ?string $createdById = null): RateImportReport;
}
