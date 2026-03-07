<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\WidgetRequest;
use App\Models\Core\Widget;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WidgetController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Widget::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Widget::dataTable($request);

    return Inertia::render(
      'Settings/Widget/Index',
    );
  }/**
   * Show the form for creating a new resource.
   */
  public function create() {}

  /**
   * Store a newly created resource in storage.
   */
  public function store(WidgetRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    $data['model_id']   = $data['model']['id'];
    $data['created_by'] = $request->user()->id;
    $widget             = Widget::create($data);
    $widget->logForCreated();
    DB::commit();
    return redirect()->back()->with('id', $widget->id);
  }

  /**
   * Display the specified resource.
   */
  public function show(Widget $widget) {
    $this->setBreadcrumbs($widget);
    $widget->showDetail();

    return Inertia::render('Settings/Widget/Show', [
      'widget' => function () use ($widget) {
        $widget->loadRelations();

        return $widget;
      },
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(Widget $widget) {
    //
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(WidgetRequest $request, Widget $widget) {
    $data = $request->validated();
    DB::beginTransaction();
    $data['model_id']   = $data['model']['id'];
    $data['created_by'] = $request->user()->id;
    $widget->fillForUpdate($data);
    $widget->logForUpdated();
    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Widget $widget) {
    DB::beginTransaction();
    $widget->logForDeleted();
    $widget->delete();
    DB::commit();
    return redirect()->back();
  }
}
