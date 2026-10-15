<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Report\SalesReportRow;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\ReportTimeSeries;
use App\Services\Report\Sales\SalesFilter;
use App\Services\Report\Sales\SalesKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Penjualan (spec modul-laporan, Req 10). Izin dicek pada modul Sales.
 */
class SalesReportController extends Controller {
    private const REPORT_KEY = 'sales';

    /** Izin dicek manual pada modul sumber (SalesOrder), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, SalesReportRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        SalesKpiBuilder $kpiBuilder,
        ReportTimeSeries $timeSeries,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! PermissionChecker::forUser($request)->can(SalesOrder::class, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, SalesFilter::KEYS);
        $filter = SalesFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = SalesReportRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        $seriesQuery = SalesReportRow::query();
        $filter->applyTo($seriesQuery);
        $series = $timeSeries->build($seriesQuery, 'transaction_date', 'sales_value');

        return Inertia::render('Report/Sales', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.sales.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.sales.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'customer_id', 'label' => __('report.filter.customer'), 'type' => 'select', 'options' => $options->customers()],
                ['key' => 'item_variant_id', 'label' => __('report.filter.item'), 'type' => 'select', 'options' => $options->items()],
            ],
            'kpi' => [
                ['key' => 'total_transaction', 'label' => __('report.sales.kpi.total_transaction'), 'value' => $kpi->values['total_transaction'], 'type' => 'number'],
                ['key' => 'total_quantity', 'label' => __('report.sales.kpi.total_quantity'), 'value' => $kpi->values['total_quantity'], 'type' => 'number'],
                ['key' => 'sales_value', 'label' => __('report.sales.kpi.sales_value'), 'value' => $kpi->values['sales_value'], 'type' => 'currency'],
                ['key' => 'tax_value', 'label' => __('report.sales.kpi.tax_value'), 'value' => $kpi->values['tax_value'], 'type' => 'currency'],
            ],
            'chart' => [
                'title'      => __('report.sales.chart'),
                'valueLabel' => __('report.sales.kpi.sales_value'),
                'series'     => $series,
            ],
            'consistency' => $consistencyChecker->check(
                __('report.sales.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }
}
