<?php

namespace App\Services\Report;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Membandingkan jumlah baris jalur KPI dengan jumlah baris jalur tabel.
 *
 * Hanya berjalan di luar production. Dilewati bila request membawa filter
 * lanjutan DataTableScope (fid, filter, search), karena selisih di situ wajar:
 * filter lanjutan hanya berlaku pada tabel.
 */
final class ReportConsistencyChecker {
    /** Parameter request yang menandai filter lanjutan DataTableScope aktif. */
    private const ADVANCED_FILTER_KEYS = ['fid', 'filter', 'search'];

    /**
     * @param  array<string, string>  $filterSummary
     * @return array{reportName: string, kpiRows: int, tableRows: int, filter: array<string, string>}|null
     */
    public function check(
        string $reportName,
        ReportKpi $kpi,
        int $tableTotal,
        array $filterSummary,
        Request $request,
    ): ?array {
        if (app()->environment('production')) {
            return null;
        }

        if ($this->hasAdvancedFilter($request)) {
            return null;
        }

        if ($kpi->rowCount === $tableTotal) {
            return null;
        }

        Log::warning('Laporan: KPI tidak konsisten dengan isi tabel', [
            'report'     => $reportName,
            'kpi_rows'   => $kpi->rowCount,
            'table_rows' => $tableTotal,
            'filter'     => $filterSummary,
        ]);

        return [
            'reportName' => $reportName,
            'kpiRows'    => $kpi->rowCount,
            'tableRows'  => $tableTotal,
            'filter'     => $filterSummary,
        ];
    }

    private function hasAdvancedFilter(Request $request): bool {
        foreach (self::ADVANCED_FILTER_KEYS as $key) {
            if ($request->filled($key)) {
                return true;
            }
        }

        return false;
    }
}
