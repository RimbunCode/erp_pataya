<?php

namespace App\Http\Controllers\Report;

use App\Http\Controllers\Controller;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Report\StockBalanceRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportAccess;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\StockBalance\StockBalanceFilter;
use App\Services\Report\StockBalance\StockBalanceKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Stok Persediaan (spec modul-laporan, Req 8).
 *
 * Konstruktor memakai StockBalanceRow sebagai model, sehingga izin select pada modul
 * Inventory diperiksa oleh Controller::__construct (Req 6.1 dan 6.2).
 */
class StockBalanceReportController extends Controller {
    private const REPORT_KEY = 'stock_balance';

    /** Izin dicek manual pada modul sumber (Inventory: StockLedgerEntry), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, StockBalanceRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        StockBalanceKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! ReportAccess::canRead($request, StockLedgerEntry::class)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, StockBalanceFilter::KEYS);
        $filter = StockBalanceFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = StockBalanceRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        return Inertia::render('Report/StockBalance', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.stock_balance.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.stock_balance.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'item_variant_id', 'label' => __('report.filter.item'), 'type' => 'select', 'options' => $options->items()],
                ['key' => 'warehouse_id', 'label' => __('report.filter.warehouse'), 'type' => 'select', 'options' => $options->warehouses()],
                ['key' => 'category_id', 'label' => __('report.filter.category'), 'type' => 'select', 'options' => $options->categories()],
            ],
            'kpi' => [
                ['key' => 'total_item', 'label' => __('report.stock_balance.kpi.total_item'), 'value' => $kpi->values['total_item'], 'type' => 'number'],
                ['key' => 'total_value', 'label' => __('report.stock_balance.kpi.total_value'), 'value' => $kpi->values['total_value'], 'type' => 'currency'],
            ],
            'consistency' => $consistencyChecker->check(
                __('report.stock_balance.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }
}
