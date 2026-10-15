<?php

namespace App\Services\Report\WorkOrder;

use App\Models\Report\WorkOrderMonitoringRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Monitoring Work Order (Req 14.6). Memakai WorkOrderMonitoringFilter yang
 * sama dengan tabel (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 *
 * Rata-rata lama pengerjaan dihitung di PHP, karena selisih tanggal belum portable antara
 * MySQL dan SQLite. Pekerjaan yang belum dimulai diabaikan (tidak ada titik awal). Bila tidak
 * ada pekerjaan yang dimulai, kunci avg_days tidak dikirim (Req 3.5).
 */
final class WorkOrderMonitoringKpiBuilder {
    public function build(WorkOrderMonitoringFilter $filter): ReportKpi {
        $query = WorkOrderMonitoringRow::query();
        $filter->applyTo($query);

        $rows = $query->get(['start_date', 'completion_date', 'progress_status']);

        $durations = $rows
            ->map(fn (WorkOrderMonitoringRow $row) => $row->duration_days)
            ->filter(fn (?float $days) => $days !== null);

        $values = [
            'total'    => $rows->count(),
            'finished' => $rows->where('progress_status', 'selesai')->count(),
            'running'  => $rows->where('progress_status', 'berjalan')->count(),
        ];

        if ($durations->isNotEmpty()) {
            $values['avg_days'] = round($durations->avg(), 1);
        }

        return new ReportKpi(values: $values, rowCount: $rows->count());
    }
}
