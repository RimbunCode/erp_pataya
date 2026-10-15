<?php

namespace App\Services\Report\Purchase;

use App\Models\Report\PurchaseReportRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Pembelian (Req 12.4). Memakai PurchaseFilter yang sama dengan tabel
 * (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 */
final class PurchaseKpiBuilder {
    public function build(PurchaseFilter $filter): ReportKpi {
        $query = PurchaseReportRow::query();
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COALESCE(SUM(total_quantity), 0) AS total_quantity,'
                . ' COALESCE(SUM(purchase_value), 0) AS purchase_value,'
                . ' COALESCE(SUM(tax_value), 0) AS tax_value',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_transaction' => (int) $row->row_count,
                'total_quantity'    => (float) $row->total_quantity,
                'purchase_value'    => (float) $row->purchase_value,
                'tax_value'         => (float) $row->tax_value,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
