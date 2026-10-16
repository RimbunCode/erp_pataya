<?php

namespace App\Services\Report\StockBalance;

use App\Models\Report\StockBalanceRow;
use App\Models\Scopes\DataTableScope;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Stok Persediaan. Memakai StockBalanceFilter yang sama dengan tabel
 * (Req 4.1), dan menghitung atas seluruh baris, bukan per halaman (Req 3.3).
 */
final class StockBalanceKpiBuilder {
    public function build(StockBalanceFilter $filter): ReportKpi {
        $query = StockBalanceRow::query();
        DataTableScope::applyBranchFilter($query);
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) AS total_item,'
                . ' COALESCE(SUM(stock_value), 0) AS total_value',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_item'  => (int) $row->total_item,
                'total_value' => (float) $row->total_value,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
