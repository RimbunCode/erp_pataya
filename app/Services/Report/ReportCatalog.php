<?php

namespace App\Services\Report;

use App\Models\Asset\AssetService;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Report\PurchaseInvoiceReportRow;
use App\Models\Report\PurchaseReportRow;
use App\Models\Report\SalesInvoiceReportRow;
use App\Models\Report\SalesReportRow;
use App\Models\Report\SparepartUsageRow;
use App\Models\Report\StockBalanceRow;
use App\Models\Report\StockMutationRow;
use App\Models\Report\TeamActivityRow;
use App\Models\Report\WorkOrderMonitoringRow;
use App\Models\Sales\SalesOrder;
use App\Services\Report\Purchase\PurchaseFilter;
use App\Services\Report\Purchase\PurchaseKpiBuilder;
use App\Services\Report\PurchaseInvoice\PurchaseInvoiceFilter;
use App\Services\Report\PurchaseInvoice\PurchaseInvoiceKpiBuilder;
use App\Services\Report\Sales\SalesFilter;
use App\Services\Report\Sales\SalesKpiBuilder;
use App\Services\Report\SalesInvoice\SalesInvoiceFilter;
use App\Services\Report\SalesInvoice\SalesInvoiceKpiBuilder;
use App\Services\Report\Sparepart\SparepartUsageFilter;
use App\Services\Report\Sparepart\SparepartUsageKpiBuilder;
use App\Services\Report\StockBalance\StockBalanceFilter;
use App\Services\Report\StockBalance\StockBalanceKpiBuilder;
use App\Services\Report\StockMutation\StockMutationFilter;
use App\Services\Report\StockMutation\StockMutationKpiBuilder;
use App\Services\Report\TeamActivity\TeamActivityFilter;
use App\Services\Report\TeamActivity\TeamActivityKpiBuilder;
use App\Services\Report\WorkOrder\WorkOrderMonitoringFilter;
use App\Services\Report\WorkOrder\WorkOrderMonitoringKpiBuilder;
use Illuminate\Support\Collection;

/**
 * Katalog sembilan laporan untuk export dan hitung ulang akurat. Kunci laporan sama dengan
 * REPORT_KEY pada tiap controller, sehingga filter yang tersimpan di session cocok.
 */
final class ReportCatalog {
    /**
     * @return array<string, ReportDefinition>
     */
    public function all(): array {
        return [
            'stock_balance' => new ReportDefinition(
                key: 'stock_balance',
                title: __('report.stock_balance.title'),
                permissionModel: StockLedgerEntry::class,
                rowModel: StockBalanceRow::class,
                filterKeys: StockBalanceFilter::KEYS,
                makeFilter: fn (array $values) => StockBalanceFilter::fromValues($values),
                kpi: fn ($filter) => app(StockBalanceKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_item'  => $rows->where('quantity', '>', 0)->count(),
                    'total_value' => (float) $rows->sum('stock_value'),
                ],
                kpiLabels: [
                    'total_item'  => __('report.stock_balance.kpi.total_item'),
                    'total_value' => __('report.stock_balance.kpi.total_value'),
                ],
                columns: [
                    'item_code'      => __('report.columns.item_code'),
                    'item_name'      => __('report.columns.item_name'),
                    'warehouse_name' => __('report.columns.warehouse'),
                    'unit_name'      => __('report.columns.unit'),
                    'quantity'       => __('report.columns.quantity'),
                    'valuation_rate' => __('report.columns.unit_price'),
                    'stock_value'    => __('report.columns.stock_value'),
                ],
            ),

            'stock_mutation' => new ReportDefinition(
                key: 'stock_mutation',
                title: __('report.stock_mutation.title'),
                permissionModel: StockLedgerEntry::class,
                rowModel: StockMutationRow::class,
                filterKeys: StockMutationFilter::KEYS,
                makeFilter: fn (array $values) => StockMutationFilter::fromValues($values),
                kpi: fn ($filter) => app(StockMutationKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_transaction' => $rows->count(),
                    'total_in'          => (float) $rows->where('quantity_change', '>', 0)->sum('quantity_change'),
                    'total_out'         => (float) abs($rows->where('quantity_change', '<', 0)->sum('quantity_change')),
                ],
                kpiLabels: [
                    'total_transaction' => __('report.stock_mutation.kpi.total_transaction'),
                    'total_in'          => __('report.stock_mutation.kpi.total_in'),
                    'total_out'         => __('report.stock_mutation.kpi.total_out'),
                ],
                columns: [
                    'transaction_date'           => __('report.columns.transaction_date'),
                    'item_code'                  => __('report.columns.item_code'),
                    'item_name'                  => __('report.columns.item_name'),
                    'warehouse_name'             => __('report.columns.warehouse'),
                    'transaction_type'           => __('report.columns.transaction_type'),
                    'quantity_change'            => __('report.columns.quantity_change'),
                    'quantity_after_transaction' => __('report.columns.quantity_after'),
                ],
            ),

            'sales' => new ReportDefinition(
                key: 'sales',
                title: __('report.sales.title'),
                permissionModel: SalesOrder::class,
                rowModel: SalesReportRow::class,
                filterKeys: SalesFilter::KEYS,
                makeFilter: fn (array $values) => SalesFilter::fromValues($values),
                kpi: fn ($filter) => app(SalesKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_transaction' => $rows->count(),
                    'total_quantity'    => (float) $rows->sum('total_quantity'),
                    'sales_value'       => (float) $rows->sum('sales_value'),
                    'tax_value'         => (float) $rows->sum('tax_value'),
                ],
                kpiLabels: [
                    'total_transaction' => __('report.sales.kpi.total_transaction'),
                    'total_quantity'    => __('report.sales.kpi.total_quantity'),
                    'sales_value'       => __('report.sales.kpi.sales_value'),
                    'tax_value'         => __('report.sales.kpi.tax_value'),
                ],
                columns: [
                    'code'             => __('report.columns.code'),
                    'transaction_date' => __('report.columns.transaction_date'),
                    'customer_name'    => __('report.columns.customer'),
                    'total_quantity'   => __('report.columns.quantity'),
                    'sales_value'      => __('report.columns.sales_value'),
                    'tax_value'        => __('report.columns.tax_value'),
                    'invoice_code'     => __('report.columns.invoice_code'),
                    'payment_label'    => __('report.columns.payment'),
                    'delivery_label'   => __('report.columns.delivery'),
                ],
            ),

            'purchase' => new ReportDefinition(
                key: 'purchase',
                title: __('report.purchase.title'),
                permissionModel: PurchaseOrder::class,
                rowModel: PurchaseReportRow::class,
                filterKeys: PurchaseFilter::KEYS,
                makeFilter: fn (array $values) => PurchaseFilter::fromValues($values),
                kpi: fn ($filter) => app(PurchaseKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_transaction' => $rows->count(),
                    'total_quantity'    => (float) $rows->sum('total_quantity'),
                    'purchase_value'    => (float) $rows->sum('purchase_value'),
                    'tax_value'         => (float) $rows->sum('tax_value'),
                ],
                kpiLabels: [
                    'total_transaction' => __('report.purchase.kpi.total_transaction'),
                    'total_quantity'    => __('report.purchase.kpi.total_quantity'),
                    'purchase_value'    => __('report.purchase.kpi.purchase_value'),
                    'tax_value'         => __('report.purchase.kpi.tax_value'),
                ],
                columns: [
                    'code'             => __('report.columns.code'),
                    'transaction_date' => __('report.columns.transaction_date'),
                    'supplier_name'    => __('report.columns.supplier'),
                    'total_quantity'   => __('report.columns.quantity'),
                    'purchase_value'   => __('report.columns.purchase_value'),
                    'tax_value'        => __('report.columns.tax_value'),
                ],
            ),

            'sales_invoice' => new ReportDefinition(
                key: 'sales_invoice',
                title: __('report.sales_invoice.title'),
                permissionModel: SalesInvoice::class,
                rowModel: SalesInvoiceReportRow::class,
                filterKeys: SalesInvoiceFilter::KEYS,
                makeFilter: fn (array $values) => SalesInvoiceFilter::fromValues($values),
                kpi: fn ($filter) => app(SalesInvoiceKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_transaction'  => $rows->count(),
                    'total_item'         => (int) $rows->sum('item_count'),
                    'total_amount'       => (float) $rows->sum('total_amount'),
                    'tax_value'          => (float) $rows->sum('tax_value'),
                    'outstanding_amount' => (float) $rows->sum('outstanding_amount'),
                ],
                kpiLabels: [
                    'total_transaction'  => __('report.sales_invoice.kpi.total_transaction'),
                    'total_item'         => __('report.sales_invoice.kpi.total_item'),
                    'total_amount'       => __('report.sales_invoice.kpi.total_amount'),
                    'tax_value'          => __('report.sales_invoice.kpi.tax_value'),
                    'outstanding_amount' => __('report.sales_invoice.kpi.outstanding_amount'),
                ],
                columns: [
                    'code'               => __('report.columns.code'),
                    'transaction_date'   => __('report.columns.transaction_date'),
                    'customer_name'      => __('report.columns.customer'),
                    'sales_order_code'   => __('report.columns.sales_order_code'),
                    'dpp_value'          => __('report.columns.dpp'),
                    'tax_value'          => __('report.columns.tax_value'),
                    'total_amount'       => __('report.columns.total_amount'),
                    'paid_total'         => __('report.columns.paid_total'),
                    'last_payment_date'  => __('report.columns.last_payment_date'),
                    'outstanding_amount' => __('report.columns.outstanding'),
                    'payment_label'      => __('report.columns.payment'),
                ],
            ),

            'purchase_invoice' => new ReportDefinition(
                key: 'purchase_invoice',
                title: __('report.purchase_invoice.title'),
                permissionModel: PurchaseInvoice::class,
                rowModel: PurchaseInvoiceReportRow::class,
                filterKeys: PurchaseInvoiceFilter::KEYS,
                makeFilter: fn (array $values) => PurchaseInvoiceFilter::fromValues($values),
                kpi: fn ($filter) => app(PurchaseInvoiceKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_transaction'  => $rows->count(),
                    'total_item'         => (int) $rows->sum('item_count'),
                    'dpp_value'          => (float) $rows->sum('dpp_value'),
                    'tax_value'          => (float) $rows->sum('tax_value'),
                    'outstanding_amount' => (float) $rows->sum('outstanding_amount'),
                ],
                kpiLabels: [
                    'total_transaction'  => __('report.purchase_invoice.kpi.total_transaction'),
                    'total_item'         => __('report.purchase_invoice.kpi.total_item'),
                    'dpp_value'          => __('report.purchase_invoice.kpi.dpp_value'),
                    'tax_value'          => __('report.purchase_invoice.kpi.tax_value'),
                    'outstanding_amount' => __('report.purchase_invoice.kpi.outstanding_amount'),
                ],
                columns: [
                    'supplier_invoice'    => __('report.columns.supplier_invoice'),
                    'transaction_date'    => __('report.columns.transaction_date'),
                    'supplier_name'       => __('report.columns.supplier'),
                    'purchase_order_code' => __('report.columns.purchase_order_code'),
                    'dpp_value'           => __('report.columns.dpp'),
                    'discount_value'      => __('report.columns.discount'),
                    'tax_value'           => __('report.columns.tax_value'),
                    'total_amount'        => __('report.columns.total_amount'),
                    'paid_total'          => __('report.columns.paid_total'),
                    'last_payment_date'   => __('report.columns.last_payment_date'),
                    'outstanding_amount'  => __('report.columns.outstanding'),
                    'external_note'       => __('report.columns.note'),
                ],
            ),

            'work_order_monitoring' => new ReportDefinition(
                key: 'work_order_monitoring',
                title: __('report.work_order.title'),
                permissionModel: AssetService::class,
                rowModel: WorkOrderMonitoringRow::class,
                filterKeys: WorkOrderMonitoringFilter::KEYS,
                makeFilter: fn (array $values) => WorkOrderMonitoringFilter::fromValues($values),
                kpi: fn ($filter) => app(WorkOrderMonitoringKpiBuilder::class)->build($filter),
                recount: function (Collection $rows) {
                    $durations = $rows->map(fn ($row) => $row->duration_days)->filter(fn ($days) => $days !== null);

                    $values = [
                        'total'    => $rows->count(),
                        'finished' => $rows->where('progress_status', 'selesai')->count(),
                        'running'  => $rows->where('progress_status', 'berjalan')->count(),
                    ];
                    if ($durations->isNotEmpty()) {
                        $values['avg_days'] = round((float) $durations->avg(), 1);
                    }

                    return $values;
                },
                kpiLabels: [
                    'total'    => __('report.work_order.kpi.total'),
                    'finished' => __('report.work_order.kpi.finished'),
                    'running'  => __('report.work_order.kpi.running'),
                    'avg_days' => __('report.work_order.kpi.avg_days'),
                ],
                columns: [
                    'code'             => __('report.columns.code'),
                    'asset_name'       => __('report.columns.asset'),
                    'service_type'     => __('report.columns.service_type'),
                    'progress_label'   => __('report.columns.progress'),
                    'transaction_date' => __('report.columns.transaction_date'),
                    'start_date'       => __('report.columns.start_date'),
                    'completion_date'  => __('report.columns.completion_date'),
                    'duration_days'    => __('report.columns.duration'),
                ],
            ),

            'sparepart_usage' => new ReportDefinition(
                key: 'sparepart_usage',
                title: __('report.sparepart_usage.title'),
                permissionModel: AssetService::class,
                rowModel: SparepartUsageRow::class,
                filterKeys: SparepartUsageFilter::KEYS,
                makeFilter: fn (array $values) => SparepartUsageFilter::fromValues($values),
                kpi: fn ($filter) => app(SparepartUsageKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_item'     => $rows->pluck('item_variant_id')->unique()->count(),
                    'total_quantity' => (float) $rows->sum('quantity'),
                    'total_value'    => (float) $rows->sum('total_value'),
                ],
                kpiLabels: [
                    'total_item'     => __('report.sparepart_usage.kpi.total_item'),
                    'total_quantity' => __('report.sparepart_usage.kpi.total_quantity'),
                    'total_value'    => __('report.sparepart_usage.kpi.total_value'),
                ],
                columns: [
                    'transaction_date' => __('report.columns.transaction_date'),
                    'code'             => __('report.columns.code'),
                    'asset_name'       => __('report.columns.asset'),
                    'item_code'        => __('report.columns.item_code'),
                    'item_name'        => __('report.columns.item_name'),
                    'quantity'         => __('report.columns.quantity'),
                    'unit_name'        => __('report.columns.unit'),
                    'unit_price'       => __('report.columns.unit_price'),
                    'total_value'      => __('report.columns.total_value'),
                ],
            ),

            'team_activity' => new ReportDefinition(
                key: 'team_activity',
                title: __('report.team_activity.title'),
                permissionModel: AssetService::class,
                rowModel: TeamActivityRow::class,
                filterKeys: TeamActivityFilter::KEYS,
                makeFilter: fn (array $values) => TeamActivityFilter::fromValues($values),
                kpi: fn ($filter) => app(TeamActivityKpiBuilder::class)->build($filter),
                recount: fn (Collection $rows) => [
                    'total_activity' => $rows->count(),
                    'total_pic'      => $rows->pluck('pic_id')->filter()->unique()->count(),
                    'total_work'     => $rows->pluck('asset_service_id')->unique()->count(),
                ],
                kpiLabels: [
                    'total_activity' => __('report.team_activity.kpi.total_activity'),
                    'total_pic'      => __('report.team_activity.kpi.total_pic'),
                    'total_work'     => __('report.team_activity.kpi.total_work'),
                ],
                columns: [
                    'transaction_date' => __('report.columns.transaction_date'),
                    'pic_label'        => __('report.columns.pic'),
                    'code'             => __('report.columns.code'),
                    'asset_name'       => __('report.columns.asset'),
                    'activity_status'  => __('report.columns.status'),
                    'description'      => __('report.columns.description'),
                ],
            ),
        ];
    }

    public function find(string $key): ?ReportDefinition {
        return $this->all()[$key] ?? null;
    }
}
