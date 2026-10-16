<?php

namespace App\Services\Report\PurchaseInvoice;

use App\Models\Report\PurchaseInvoiceReportRow;
use App\Services\Report\ReportKpi;

/**
 * KPI Laporan Invoice Pembelian (Req 13.4). Memakai PurchaseInvoiceFilter yang sama dengan
 * tabel (Req 4.1) dan menghitung atas seluruh baris hasil filter (Req 3.3).
 */
final class PurchaseInvoiceKpiBuilder {
    public function build(PurchaseInvoiceFilter $filter): ReportKpi {
        $query = PurchaseInvoiceReportRow::query();
        $filter->applyTo($query);

        $row = $query
            ->selectRaw(
                'COUNT(*) AS row_count,'
                . ' COALESCE(SUM(item_count), 0) AS total_item,'
                . ' COALESCE(SUM(dpp_value), 0) AS dpp_value,'
                . ' COALESCE(SUM(tax_value), 0) AS tax_value,'
                . ' COALESCE(SUM(outstanding_amount), 0) AS outstanding_amount',
            )
            ->first();

        return new ReportKpi(
            values: [
                'total_transaction'  => (int) $row->row_count,
                'total_item'         => (int) $row->total_item,
                'dpp_value'          => (float) $row->dpp_value,
                'tax_value'          => (float) $row->tax_value,
                'outstanding_amount' => (float) $row->outstanding_amount,
            ],
            rowCount: (int) $row->row_count,
        );
    }
}
