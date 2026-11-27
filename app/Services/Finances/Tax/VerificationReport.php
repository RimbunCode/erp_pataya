<?php

namespace App\Services\Finances\Tax;

/**
 * Laporan `TaxEngine::verify()` (Finance Fase 3, Requirement 4.6): perhitungan ulang dari versi aturan yang
 * di-snapshot dibandingkan dengan angka di snapshot. Perbandingan dilakukan per baris dengan toleransi satu minor
 * unit, karena nilai tersimpan Bagian A tidak dibulatkan (kolom generated `double`) sehingga selisih per baris
 * dapat mencapai setengah minor unit (design.md, Temuan Task 1.3 butir 2).
 */
final readonly class VerificationReport {
    /**
     * @param  list<array{line_ref: string|null, tax_id: string, field: string, snapshot: string, recomputed: string, difference_minor: int}>  $differences  selisih di atas toleransi
     * @param  list<array{line_ref: string|null, tax_id: string, reason: string}>  $skipped  komponen yang tidak dapat diverifikasi (mis. `legacy`, `version_unavailable`)
     */
    public function __construct(
        public bool $passed,
        public array $differences = [],
        public array $skipped = [],
        public int $verifiedComponents = 0,
    ) {}
}
