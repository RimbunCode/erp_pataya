<?php

namespace App\Http\Controllers\Report;

use App\Http\Controllers\Controller;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Report\StockMutationRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportAccess;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\StockMutation\StockMutationFilter;
use App\Services\Report\StockMutation\StockMutationKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Mutasi Stock (spec modul-laporan, Req 9).
 *
 * Sama seperti Stok Persediaan: izin dicek pada modul Inventory (Req 6.1 dan 6.2),
 * dan tabel serta KPI memakai StockMutationFilter yang sama (Req 4.1).
 */
class StockMutationReportController extends Controller {
    private const REPORT_KEY = 'stock_mutation';

    /** Izin dicek manual pada modul sumber (Inventory: StockLedgerEntry), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, StockMutationRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        StockMutationKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! ReportAccess::canRead($request, StockLedgerEntry::class)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, StockMutationFilter::KEYS);
        $filter = StockMutationFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = StockMutationRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        return Inertia::render('Report/StockMutation', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.stock_mutation.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.stock_mutation.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'item_variant_id', 'label' => __('report.filter.item'), 'type' => 'select', 'options' => $options->items()],
                ['key' => 'warehouse_id', 'label' => __('report.filter.warehouse'), 'type' => 'select', 'options' => $options->warehouses()],
            ],
            'kpi' => [
                ['key' => 'total_transaction', 'label' => __('report.stock_mutation.kpi.total_transaction'), 'value' => $kpi->values['total_transaction'], 'type' => 'number'],
                ['key' => 'total_in', 'label' => __('report.stock_mutation.kpi.total_in'), 'value' => $kpi->values['total_in'], 'type' => 'number'],
                ['key' => 'total_out', 'label' => __('report.stock_mutation.kpi.total_out'), 'value' => $kpi->values['total_out'], 'type' => 'number'],
            ],
            'consistency' => $consistencyChecker->check(
                __('report.stock_mutation.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }
}
