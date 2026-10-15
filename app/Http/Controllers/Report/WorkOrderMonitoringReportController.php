<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Asset\AssetService;
use App\Models\Report\WorkOrderMonitoringRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\WorkOrder\WorkOrderMonitoringFilter;
use App\Services\Report\WorkOrder\WorkOrderMonitoringKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Monitoring Work Order (spec modul-laporan, Req 14). Berbasis AssetService dan
 * izin modul Asset / Service.
 */
class WorkOrderMonitoringReportController extends Controller {
    private const REPORT_KEY = 'work_order_monitoring';

    /** Izin dicek manual pada modul sumber (AssetService), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, WorkOrderMonitoringRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        WorkOrderMonitoringKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! PermissionChecker::forUser($request)->can(AssetService::class, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, WorkOrderMonitoringFilter::KEYS);
        $filter = WorkOrderMonitoringFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = WorkOrderMonitoringRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        $kpiItems = [
            ['key' => 'total', 'label' => __('report.work_order.kpi.total'), 'value' => $kpi->values['total'], 'type' => 'number'],
            ['key' => 'finished', 'label' => __('report.work_order.kpi.finished'), 'value' => $kpi->values['finished'], 'type' => 'number'],
            ['key' => 'running', 'label' => __('report.work_order.kpi.running'), 'value' => $kpi->values['running'], 'type' => 'number'],
        ];
        // Rata-rata tidak dikirim bila tidak ada pekerjaan yang dimulai (Req 3.5).
        if (array_key_exists('avg_days', $kpi->values)) {
            $kpiItems[] = ['key' => 'avg_days', 'label' => __('report.work_order.kpi.avg_days'), 'value' => $kpi->values['avg_days'], 'type' => 'number'];
        }

        return Inertia::render('Report/WorkOrderMonitoring', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.work_order.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.work_order.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'progress_status', 'label' => __('report.filter.status'), 'type' => 'select', 'options' => $this->progressOptions()],
                ['key' => 'service_type', 'label' => __('report.filter.service_type'), 'type' => 'select', 'options' => $options->serviceTypes()],
                ['key' => 'asset_id', 'label' => __('report.filter.asset'), 'type' => 'select', 'options' => $options->assets()],
            ],
            'kpi'         => $kpiItems,
            'consistency' => $consistencyChecker->check(
                __('report.work_order.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function progressOptions(): array {
        return collect(WorkOrderMonitoringFilter::PROGRESS_STATUSES)
            ->map(fn (string $status) => ['value' => $status, 'label' => __('report.work_order.progress.' . $status)])
            ->values()
            ->all();
    }
}
