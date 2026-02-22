<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Dashboard;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller {
  /**
   * Display a listing of the resource.
   */
  public function index() {
    return Inertia::render('Dashboard');
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
  public function show(Dashboard $dashboard) {
    //
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
  public function update(Request $request, Dashboard $dashboard) {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Dashboard $dashboard) {
    //
  }
}
