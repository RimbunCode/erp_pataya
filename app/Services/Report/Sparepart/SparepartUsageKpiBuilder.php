<?php

namespace App\Services\Report\Sparepart;

use App\Models\Report\SparepartUsageRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Pemakaian Sparepart (Req 15.4). Memakai SparepartUsageFilter yang sama dengan
 * tabel (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 */
final class SparepartUsageKpiBuilder {
    public function build(SparepartUsageFilter $filter): ReportKpi {
        $query = SparepartUsageRow::query();
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COUNT(DISTINCT item_variant_id) AS total_item,'
                . ' COALESCE(SUM(quantity), 0) AS total_quantity,'
                . ' COALESCE(SUM(total_value), 0) AS total_value',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_item'     => (int) $row->total_item,
                'total_quantity' => (float) $row->total_quantity,
                'total_value'    => (float) $row->total_value,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
