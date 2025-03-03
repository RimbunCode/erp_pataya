<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\UserRequest;
use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Models\User\RolePermission;
use App\Models\User\User;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class UserController extends Controller {

  public function __construct(Request $request) {
    parent::__construct($request, User::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    if (!Utils::isInertiaRequest($request)) {
      $users = User::query();
      if ($request->has('search')) {
        $users->whereAny(['name', 'email', 'username'], 'like', "%{$request->search}%");
      }
      return response()->json($users->get());
    }
    $this->setBreadcrumbs();
    // dd(json_decode(stripslashes($_COOKIE['datatable_columns'])));
    User::dataTable($request);
    return Inertia::render('Users/ManageUsers/Index',);
  }
  public function image(Request $request, User $user) {
    DB::beginTransaction();
    File::uploadFile($request, 'ImageProfile', function ($file) use ($user) {
      $user->update([
        'image' => $file->id,
      ]);
    });
    DB::commit();

    return back();
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
  public function show(Request $request, User $user) {
    if ($request->user()->id != $user->id) {
      $this->guard('read');
    }
    $this->setBreadcrumbs($user);
    $user->showDetail();
    $user->roles = $user->roles()->pluck('id');
    return Inertia::render('Users/ManageUsers/Show', [
      'user' => $user,
      'roles' => Inertia::defer(function () {
        return \App\Models\User\Role::all();
      })
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(UserRequest $request, User $user) {
    if ($request->user()->id != $user->id) {
      $this->guard('write');
    }
    $data = $request->validated();
    DB::beginTransaction();
    $user->update($data);
    $user->roles()->sync($data['roles']);
    $user->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini'
      ]
    ]);
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
