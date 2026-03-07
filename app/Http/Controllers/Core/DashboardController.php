<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\DashboardRequest;
use App\Models\Core\Dashboard;
use DB;
use Illuminate\Http\Request;
use Inertia\Inertia;

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
