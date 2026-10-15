<?php

namespace App\Services\Report\TeamActivity;

use App\Models\Report\TeamActivityRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Anggota Tim (Req 16.4). Memakai TeamActivityFilter yang sama dengan tabel
 * (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 *
 * Jumlah PIC dan jumlah pekerjaan adalah nilai unik. Aktivitas tanpa PIC tidak ikut
 * dihitung sebagai PIC, karena COUNT(DISTINCT) mengabaikan NULL.
 */
final class TeamActivityKpiBuilder {
    public function build(TeamActivityFilter $filter): ReportKpi {
        $query = TeamActivityRow::query();
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COUNT(DISTINCT pic_id) AS total_pic,'
                . ' COUNT(DISTINCT asset_service_id) AS total_work',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_activity' => (int) $row->row_count,
                'total_pic'      => (int) $row->total_pic,
                'total_work'     => (int) $row->total_work,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
