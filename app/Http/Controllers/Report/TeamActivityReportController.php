<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Asset\AssetService;
use App\Models\Report\TeamActivityRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\TeamActivity\TeamActivityFilter;
use App\Services\Report\TeamActivity\TeamActivityKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Anggota Tim (spec modul-laporan, Req 16). Izin dicek pada modul Asset / Service.
 */
class TeamActivityReportController extends Controller {
    private const REPORT_KEY = 'team_activity';

    /** Izin dicek manual pada modul sumber (AssetService), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, TeamActivityRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        TeamActivityKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! PermissionChecker::forUser($request)->can(AssetService::class, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, TeamActivityFilter::KEYS);
        $filter = TeamActivityFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = TeamActivityRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        return Inertia::render('Report/TeamActivity', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.team_activity.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.team_activity.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'pic_id', 'label' => __('report.filter.pic'), 'type' => 'select', 'options' => $options->users()],
                ['key' => 'activity_status', 'label' => __('report.filter.status'), 'type' => 'select', 'options' => $options->activityStatuses()],
            ],
            'kpi' => [
                ['key' => 'total_activity', 'label' => __('report.team_activity.kpi.total_activity'), 'value' => $kpi->values['total_activity'], 'type' => 'number'],
                ['key' => 'total_pic', 'label' => __('report.team_activity.kpi.total_pic'), 'value' => $kpi->values['total_pic'], 'type' => 'number'],
                ['key' => 'total_work', 'label' => __('report.team_activity.kpi.total_work'), 'value' => $kpi->values['total_work'], 'type' => 'number'],
            ],
            'consistency' => $consistencyChecker->check(
                __('report.team_activity.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }
}
