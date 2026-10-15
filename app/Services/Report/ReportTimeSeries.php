<?php

namespace App\Services\Report;

use Illuminate\Database\Eloquent\Builder;

/**
 * Pembangun deret waktu untuk grafik garis laporan (spec modul-laporan, Req 1.2,
 * 10.5, dan 12.5).
 *
 * Menerima builder yang sudah difilter dengan ReportFilter yang sama dengan tabel
 * dan KPI, lalu mengagregasi nilai per tanggal. Tanggal tanpa baris tidak
 * dimunculkan, dan rentang tanpa data menghasilkan deret kosong, bukan error.
 */
final class ReportTimeSeries {
    /**
     * @param  string  $dateColumn  kolom tanggal (sudah pasti ada di view/tabel sumber)
     * @param  string  $valueExpression  ekspresi SQL yang dijumlahkan per tanggal
     * @return list<array{date: string, value: float}>
     */
    public function build(Builder $query, string $dateColumn, string $valueExpression): array {
        return $query
            ->selectRaw("DATE({$dateColumn}) AS period, COALESCE(SUM({$valueExpression}), 0) AS total")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(fn ($row) => ['date' => (string) $row->period, 'value' => (float) $row->total])
            ->values()
            ->all();
    }
}
