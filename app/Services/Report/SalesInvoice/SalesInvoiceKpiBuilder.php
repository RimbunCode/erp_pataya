<?php

namespace App\Services\Report\SalesInvoice;

use App\Models\Report\SalesInvoiceReportRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Invoice Penjualan (Req 11.6). Memakai SalesInvoiceFilter yang sama dengan
 * tabel (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 */
final class SalesInvoiceKpiBuilder {
    public function build(SalesInvoiceFilter $filter): ReportKpi {
        $query = SalesInvoiceReportRow::query();
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COALESCE(SUM(item_count), 0) AS total_item,'
                . ' COALESCE(SUM(total_amount), 0) AS total_amount,'
                . ' COALESCE(SUM(tax_value), 0) AS tax_value,'
                . ' COALESCE(SUM(outstanding_amount), 0) AS outstanding_amount',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_transaction'  => (int) $row->row_count,
                'total_item'         => (int) $row->total_item,
                'total_amount'       => (float) $row->total_amount,
                'tax_value'          => (float) $row->tax_value,
                'outstanding_amount' => (float) $row->outstanding_amount,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
