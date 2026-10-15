<?php

namespace App\Services\Report;

/**
 * Hasil agregasi KPI laporan. `rowCount` adalah jumlah baris yang ikut dihitung,
 * dibandingkan dengan total paginator tabel oleh ReportConsistencyChecker.
 */
final class ReportKpi {
    /**
     * @param  array<string, int|float>  $values  nama KPI => nilai
     * @param  int  $rowCount  jumlah baris yang ikut dihitung
     */
    public function __construct(
        public readonly array $values,
        public readonly int $rowCount,
    ) {}
}
