<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Models\User\User;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class UserController extends Controller {

  public function __construct() {
    $this->model = User::class;
  }
  private function setBreadcrumbs(User $user = null) {
    $breadcrumbs = $user ? [
      ['name' => 'Manage Users', 'link' => route('users.index')],
      ['name' => $user->name],
    ] : [
      ['name' => 'Manage Users'],
    ];

    Inertia::share([
      'breadcrumbs' => $breadcrumbs,
    ]);
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
  public function show(User $user) {
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(User $user) {
    $this->setBreadcrumbs($user);
    $user->showDetail();
    return Inertia::render('Users/ManageUsers/Edit', [
      'user' => $user,
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
