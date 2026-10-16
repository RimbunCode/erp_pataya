<?php

namespace App\Services\Report\Sales;

use App\Models\Report\SalesReportRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Penjualan (Req 10.4). Memakai SalesFilter yang sama dengan tabel
 * (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 */
final class SalesKpiBuilder {
    public function build(SalesFilter $filter): ReportKpi {
        $query = SalesReportRow::query();
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COALESCE(SUM(total_quantity), 0) AS total_quantity,'
                . ' COALESCE(SUM(sales_value), 0) AS sales_value,'
                . ' COALESCE(SUM(tax_value), 0) AS tax_value',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_transaction' => (int) $row->row_count,
                'total_quantity'    => (float) $row->total_quantity,
                'sales_value'       => (float) $row->sales_value,
                'tax_value'         => (float) $row->tax_value,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
