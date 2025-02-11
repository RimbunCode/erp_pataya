<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Core\Log;
use App\Models\Core\Tag;
use App\Models\User\User;
use Illuminate\Http\Request;
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
    $this->setBreadcrumbs();
    // dd(json_decode(stripslashes($_COOKIE['datatable_columns'])));
    $options = $request->query();
    $optionsSort = isset($options['sort']) ?? "-created_at" ? explode("-", $options['sort']) : [""];
    $optionsSortKey = end($optionsSort);
    $optionsSortOrder = $optionsSort[0] === $optionsSortKey ? "asc" : "desc";

    $options['show'] = isset($options['show']) ?? 25;

    $users = User::paginate(25);
    return Inertia::render('Users/ManageUsers/Index', [
      'data' => Inertia::merge($users),
      'sort' => '-created_at',
      'show' => 25,
    ]);
  }
  public function data(Request $request) {
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
    return Inertia::render('Users/ManageUsers/Show', [
      'user' => $user,
      'logs' => Inertia::defer(function () use ($user) {
        return Log::with('user')
          ->where('loggable_type', $this->model)
          ->where('loggable_id', operator: $user->id)
          ->orderByDesc('created_at')
          ->get();
      }),
      'tags' => Inertia::defer(function () use ($user) {
        return $user->tags()
          ->get(['id', 'name']);
      }),
      'attachments' => Inertia::defer(function () use ($user) {
        return $user->files()
          ->get(['id', 'name']);
      })
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
