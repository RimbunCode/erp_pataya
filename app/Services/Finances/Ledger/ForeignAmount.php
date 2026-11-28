<?php

namespace App\Services\Finances\Ledger;

/**
 * Jumlah mata uang asing sebuah baris jurnal (Finance Fase 4, Requirement 3.3): kode mata uang, jumlah asing (positif,
 * pada sisi yang sama dengan baris), kurs (nilai dasar per 1 unit asing, apa adanya di dokumen) dan, bila kurs berasal
 * dari master, `exchange_rate_id` penanda kurs dirujuk (keputusan pemilik produk 28 November 2026). `JournalDraftValidator`
 * memastikan `debit/credit dasar` ≈ `jumlah asing × kurs` dalam toleransi satu minor unit (Requirement 3.4).
 */
final readonly class ForeignAmount {
    public function __construct(
        public string $currencyCode,
        public string $amount,
        public string $rate,
        public ?string $exchangeRateId = null,
    ) {}
}
