<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Report\PurchaseReportRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\Purchase\PurchaseFilter;
use App\Services\Report\Purchase\PurchaseKpiBuilder;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\ReportTimeSeries;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Pembelian (spec modul-laporan, Req 12). Izin dicek pada modul Purchase.
 */
class PurchaseReportController extends Controller {
    private const REPORT_KEY = 'purchase';

    /** Izin dicek manual pada modul sumber (PurchaseOrder), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, PurchaseReportRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        PurchaseKpiBuilder $kpiBuilder,
        ReportTimeSeries $timeSeries,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! PermissionChecker::forUser($request)->can(PurchaseOrder::class, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, PurchaseFilter::KEYS);
        $filter = PurchaseFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = PurchaseReportRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        $seriesQuery = PurchaseReportRow::query();
        $filter->applyTo($seriesQuery);
        $series = $timeSeries->build($seriesQuery, 'transaction_date', 'purchase_value');

        return Inertia::render('Report/Purchase', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.purchase.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.purchase.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'supplier_id', 'label' => __('report.filter.supplier'), 'type' => 'select', 'options' => $options->suppliers()],
                ['key' => 'item_variant_id', 'label' => __('report.filter.item'), 'type' => 'select', 'options' => $options->items()],
            ],
            'kpi' => [
                ['key' => 'total_transaction', 'label' => __('report.purchase.kpi.total_transaction'), 'value' => $kpi->values['total_transaction'], 'type' => 'number'],
                ['key' => 'total_quantity', 'label' => __('report.purchase.kpi.total_quantity'), 'value' => $kpi->values['total_quantity'], 'type' => 'number'],
                ['key' => 'purchase_value', 'label' => __('report.purchase.kpi.purchase_value'), 'value' => $kpi->values['purchase_value'], 'type' => 'currency'],
                ['key' => 'tax_value', 'label' => __('report.purchase.kpi.tax_value'), 'value' => $kpi->values['tax_value'], 'type' => 'currency'],
            ],
            'chart' => [
                'title'      => __('report.purchase.chart'),
                'valueLabel' => __('report.purchase.kpi.purchase_value'),
                'series'     => $series,
            ],
            'consistency' => $consistencyChecker->check(
                __('report.purchase.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }
}
