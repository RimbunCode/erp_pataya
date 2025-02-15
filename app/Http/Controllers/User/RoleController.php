<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\User\Role;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RoleController extends Controller {
  public function __construct() {
    $this->model = Role::class;
  }
  private function setBreadcrumbs(Role $role = null) {
    $breadcrumbs = $role ? [
      ['name' => 'Roles', 'link' => route('roles.index')],
      ['name' => $role->name],
    ] : [
      ['name' => 'Roles'],
    ];

    Inertia::share([
      'breadcrumbs' => $breadcrumbs,
    ]);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Role::orderBy('name')->dataTable($request);
    return Inertia::render('Users/Roles/Index',);
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
  public function show(string $id) {
    //
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(Role $role) {
    $this->setBreadcrumbs($role);
    $role->showDetail();
    return Inertia::render('Users/Roles/Edit', [
      'role' => $role,
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(Request $request, string $id) {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}
