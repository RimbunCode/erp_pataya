<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Tag;
use App\Utils;
use Illuminate\Http\Request;

class TagController extends Controller {
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $tags = Tag::query();
    if (!Utils::isInertiaRequest($request)) {
      if ($request->has('search')) {
        $tags = $tags->where('name', 'like', "%{$request->search}%");
      }
      if ($request->has('limit')) {
        $tags = $tags->limit($request->limit ?? 10);
      }
      if ($request->has('excepts')) {
        $tags = $tags->whereNotIn('name', $request->excepts);
      }
      $tags = $tags->get();

      return response()->json($tags);
    }
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
  public function edit(string $id) {
    //
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
