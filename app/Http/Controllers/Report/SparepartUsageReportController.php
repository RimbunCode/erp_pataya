<?php

namespace App\Http\Controllers\Report;

use App\Http\Controllers\Controller;
use App\Models\Asset\AssetService;
use App\Models\Report\SparepartUsageRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportAccess;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\Sparepart\SparepartUsageFilter;
use App\Services\Report\Sparepart\SparepartUsageKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Pemakaian Sparepart (spec modul-laporan, Req 15). Izin dicek pada modul Asset / Service.
 */
class SparepartUsageReportController extends Controller {
    private const REPORT_KEY = 'sparepart_usage';

    /** Izin dicek manual pada modul sumber (AssetService), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, SparepartUsageRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        SparepartUsageKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! ReportAccess::canRead($request, AssetService::class)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, SparepartUsageFilter::KEYS);
        $filter = SparepartUsageFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = SparepartUsageRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        return Inertia::render('Report/SparepartUsage', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.sparepart_usage.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.sparepart_usage.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'item_variant_id', 'label' => __('report.filter.item'), 'type' => 'select', 'options' => $options->items()],
                ['key' => 'asset_id', 'label' => __('report.filter.asset'), 'type' => 'select', 'options' => $options->assets()],
            ],
            'kpi' => [
                ['key' => 'total_item', 'label' => __('report.sparepart_usage.kpi.total_item'), 'value' => $kpi->values['total_item'], 'type' => 'number'],
                ['key' => 'total_quantity', 'label' => __('report.sparepart_usage.kpi.total_quantity'), 'value' => $kpi->values['total_quantity'], 'type' => 'number'],
                ['key' => 'total_value', 'label' => __('report.sparepart_usage.kpi.total_value'), 'value' => $kpi->values['total_value'], 'type' => 'currency'],
            ],
            'consistency' => $consistencyChecker->check(
                __('report.sparepart_usage.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }
}
