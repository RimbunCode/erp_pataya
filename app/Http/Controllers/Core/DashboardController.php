<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\DashboardRequest;
use App\Http\Requests\Core\DashboardWidgetOrderRequest;
use App\Models\Core\Dashboard;
use App\Models\DashboardWidget;
use DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\Uid\Ulid;

class DashboardController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Dashboard::class);
    }

    private function fillWidgetRelation(array $data, Dashboard $dashboard) {
        $data['widget_id'] = $data['widget']['id'];

        return $data;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Dashboard::dataTable($request);

        return Inertia::render(
            'Settings/Dashboard/Index',
        );
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(DashboardRequest $request) {
        $data               = $request->validated();
        $data['created_by'] = $request->user()->id;
        DB::beginTransaction();
        $dashboard = Dashboard::create($data);

        foreach ($data['widgets'] as $idx => $widget) {
            $widget['order'] = $idx;
            $widget          = $this->fillWidgetRelation($widget, $dashboard);
            $widget          = $dashboard->widgets()->create($widget);

            $widget->refresh();

        }
        $dashboard = Dashboard::create($data);
        $dashboard->logForCreated();
        DB::commit();

        return redirect()->back()->with('id', $dashboard->id);
    }

    public function storeUserDashboard(Request $request) {
        $user       = $request->user();
        $dashboards = $request->validate([
            'dashboards'                => ['required', 'array', 'min:1'],
            'dashboards.*.dashboard.id' => ['required', 'exists:dashboards,id'],
        ]);
        $dashboards = array_map(
            fn ($dashboard) => $dashboard['dashboard']['id'],
            $dashboards['dashboards'],
        );
        // dd($dashboards);
        DB::beginTransaction();
        $user->dashboards()->detach();

        foreach ($dashboards as $order => $dashboardId) {
            $user->dashboards()->attach($dashboardId, [
                'id'    => (string) new Ulid,
                'order' => $order,
            ]);
        }

        DB::commit();

        return response()->noContent();
    }

    public function reorderWidgets(DashboardWidgetOrderRequest $request, Dashboard $dashboard) {
        abort_unless(
            $request->user()->dashboards()->where('dashboards.id', $dashboard->id)->exists(),
            403,
        );

        $orderedWidgetIds     = collect($request->validated('widgets'))->pluck('id')->values();
        $dashboardWidgetCount = DashboardWidget::query()
            ->where('dashboard_id', $dashboard->id)
            ->count();

        if ($orderedWidgetIds->count() !== $dashboardWidgetCount) {
            abort(422, 'The widgets payload must include every widget in this dashboard.');
        }

        $existingCount = DashboardWidget::query()
            ->where('dashboard_id', $dashboard->id)
            ->whereIn('id', $orderedWidgetIds)
            ->count();

        if ($existingCount !== $orderedWidgetIds->count()) {
            abort(422, 'One or more widgets are not part of this dashboard.');
        }

        DB::beginTransaction();

        foreach ($orderedWidgetIds as $order => $widgetId) {
            DashboardWidget::query()
                ->where('dashboard_id', $dashboard->id)
                ->where('id', $widgetId)
                ->update([
                    'order' => $order,
                ]);
        }

        DB::commit();

        return response()->noContent();
    }

    /**
     * Display the specified resource.
     */
    public function show(Dashboard $dashboard) {
        $this->setBreadcrumbs($dashboard);
        $dashboard->showDetail();

        return Inertia::render('Settings/Dashboard/Show', [
            'dashboard' => function () use ($dashboard) {
                $dashboard->loadRelations();

                return $dashboard;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Dashboard $dashboard) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(DashboardRequest $request, Dashboard $dashboard) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['created_by'] = $request->user()->id;
        $dashboard->widgets()
            ->whereNotIn('id', array_column($data['widgets'], 'id'))
            ->delete();
        foreach ($data['widgets'] as $idx => $widget) {
            $widget['order'] = $idx;
            $widget          = $this->fillWidgetRelation($widget, $dashboard);
            if (Ulid::isValid($widget['id'])) {
                $widget = $dashboard->widgets()
                    ->find($widget['id'])->fill($widget);
                $widget->save();
            } else {
                $widget = $dashboard->widgets()->create($widget);
            }

            $widget->refresh();
        }
        $dashboard->fillForUpdate($data);
        $dashboard->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Dashboard $dashboard) {
        DB::beginTransaction();
        $dashboard->logForDeleted();
        $dashboard->delete();
        DB::commit();

        return redirect()->back();
    }
}
