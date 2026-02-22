<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Widget;
use Illuminate\Http\Request;
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
  public function store(Request $request) {
    //
  }

  /**
   * Display the specified resource.
   */
  public function show(Widget $widget) {
    //
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
  public function update(Request $request, Widget $widget) {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Widget $widget) {
    //
  }
}
