<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\RoleRequest;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class RoleController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Role::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Role::dataTable($request);
    return Inertia::render('Users/Roles/Index',);
  }
  public function permissions(Request $request) {
    if ($this->isInertiaRequest($request)) {
      abort(404);
    }
    $permissions = Permission::orderBy('name');
    if ($request->search) {
      $permissions->whereAny(['name', 'module', 'id'], 'like', "%{$request->search}%");
    }
    return response()->json($permissions->limit(10)->get());
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
  public function show(Request $request, Role $role) {
    if (!$this->isInertiaRequest($request)) {
      $role->load('rules');
      return response()->json($role);
    }
    $this->setBreadcrumbs($role);
    $role->showDetail();
    return Inertia::render('Users/Roles/Edit', [
      'role' => function () use ($role) {
        $role->load('rules');
        return $role;
      },
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(RoleRequest $request, Role $role) {
    $data = $request->validated();
    DB::beginTransaction();
    $role->update([
      'name' => $data['name'],
      'description' => $data['description'] ?? '',
      'is_disabled' => $data['is_disabled'],
    ]);

    $permissions = array_map(fn($permission) => $permission['permission_id'], $data['rules']);
    $permissions = Permission::whereIn('id', $permissions)->get()
      ->mapWithKeys(fn($permission) => [$permission->id => $permission]);

    foreach ($data['rules'] as $rule) {
      $permission = $permissions[$rule['permission_id']];
      RolePermission::updateOrCreate([
        'role_id' => $role->id,
        'permission_id' => $permission->id,
      ], values: [
        'name' => $permission->name,
        'model' => $permission->model,
        'level' => $rule['level'],
        'only_creator' => $rule['only_creator'],
        'permissions' => collect($permission->permissions)->mapWithKeys(function ($permission) use ($rule) {
          return [$permission => $rule['permissions'][$permission] ?? false];
        }),
      ]);
    }

    DB::commit();
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}
