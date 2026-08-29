<?php

namespace App\Http\Controllers\Core;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\ChartRequest;
use App\Models\Core\Chart;
use App\Services\Core\ChartService;
use App\Services\Core\PermissionChecker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ChartController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Chart::class);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'getData' => 'select',
            default   => null,
        };
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        $this->scopeVisible(Chart::query(), $request)->dataTable($request);

        return Inertia::render('Settings/Chart/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/Chart/Show');
    }

    public function store(ChartRequest $request) {
        $data  = $this->prepareData($request);
        $chart = Chart::create($data);
        $this->syncAssignables($chart, $request->input('assignables', []));

        return redirect()->back()->with('id', $chart->id);
    }

    public function show(Chart $chart) {
        $this->setBreadcrumbs($chart);
        $chart->showDetail();

        return Inertia::render('Settings/Chart/Show', [
            'chart' => function () use ($chart) {
                $chart->loadRelations();

                return $chart;
            },
        ]);
    }

    public function edit(Chart $chart) {
        //
    }

    public function update(ChartRequest $request, Chart $chart) {
        $data = $this->prepareData($request);
        $chart->fillForUpdate($data);
        $this->syncAssignables($chart, $request->input('assignables', []));

        return redirect()->back();
    }

    private function prepareData(ChartRequest $request): array {
        $data = $request->validated();
        if ($request->input('chart_source_type') !== 'custom') {
            $data['model_id']    = $data['model']['id'];
            $data['model_class'] = $data['model']['model'];
        }
        $data['created_by_id'] = $request->user()->id;
        unset($data['model'], $data['assignables']);

        return $data;
    }

    private function syncAssignables(Chart $chart, array $assignables): void {
        $chart->assignables()->delete();
        foreach ($assignables as $row) {
            $chart->assignables()->create([
                'assignable_id'   => $row['assignable']['id'],
                'assignable_type' => $row['assignable']['type'],
            ]);
        }
    }

    /** Requirement 8.1/8.2 — sama pola NumberCardController::scopeVisible(). */
    private function scopeVisible(Builder $query, Request $request): Builder {
        $user    = $request->user();
        $checker = PermissionChecker::forUser($request);
        $roleIds = $user->roles()->pluck('id')->all();

        $permittedClasses = Chart::query()
            ->whereNotNull('model_class')
            ->distinct()
            ->pluck('model_class')
            ->filter(fn ($class) => $checker->can($class, Permission::Select))
            ->all();

        return $query
            ->where(fn (Builder $q) => $q->whereIn('model_class', $permittedClasses))
            ->orWhere(fn (Builder $q) => $q->visibleByShare($user, $roleIds));
    }

    /** Requirement 8.4 — sama pola NumberCardController::assertVisible(). */
    private function assertVisible(Chart $chart, Request $request): void {
        $checker = PermissionChecker::forUser($request);
        $roleIds = $request->user()->roles()->pluck('id')->all();

        $visible = ($chart->model_class && $checker->can($chart->model_class, Permission::Select))
            || $chart->isSharedWith($request->user(), $roleIds);

        abort_unless($visible, 403);
    }

    public function getData(Request $request, Chart $chart, ChartService $service) {
        $this->assertVisible($chart, $request);

        $filters = $request->input('filters', []);
        $config  = $request->input('config', []);

        $checker = PermissionChecker::forUser($request);
        $data    = $service->getData($chart, $filters, $checker, $config);

        return response()->json($data);
    }
}
