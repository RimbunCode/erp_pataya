<?php

namespace App\Services\Report\StockMutation;

use App\Models\Report\StockMutationRow;
use App\Models\Scopes\DataTableScope;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Mutasi Stock. Memakai StockMutationFilter dan aturan cabang yang sama
 * dengan tabel (Req 4.1 dan 6.4), lalu menghitung atas seluruh baris, bukan per
 * halaman (Req 3.3).
 *
 * Item masuk adalah jumlah perubahan positif, item keluar adalah jumlah perubahan
 * negatif yang ditampilkan sebagai angka positif.
 */
final class StockMutationKpiBuilder {
    public function build(StockMutationFilter $filter): ReportKpi {
        $query = StockMutationRow::query();
        DataTableScope::applyBranchFilter($query);
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COALESCE(SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END), 0) AS total_in,'
                . ' COALESCE(SUM(CASE WHEN quantity_change < 0 THEN -quantity_change ELSE 0 END), 0) AS total_out',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_transaction' => (int) $row->row_count,
                'total_in'          => (float) $row->total_in,
                'total_out'         => (float) $row->total_out,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
