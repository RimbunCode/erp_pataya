<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ModelController extends Controller {

  public function __invoke(Request $request) {
    if ($this->isInertiaRequest($request)) {
      abort(404);
      return;
    }
    $model = $request->model;
    $search = $request->search;
    $template = $model::templateLink();
    // Ekstrak daftar atribut dari template
    preg_match_all('/:\w+/', $template, $matches);
    // Hapus tanda `:` agar hanya mendapatkan nama atribut
    $attributes = array_map(fn($attr) => ltrim($attr, ':'), $matches[0]);
    $query = $model::where(function ($query) use ($search, $attributes) {
      $splitSearch = explode(" ", $search);
      foreach ($splitSearch as $item) {
        preg_match_all('/[a-zA-Z0-9]+/', $item, $matches);

        if (count($matches[0]) == 1 && $item == $matches[0][0]) {
          $query->whereAny($attributes, 'like', "%{$item}%");
          continue;
        }

        $query->where(function ($query) use ($matches, $item, $attributes) {
          $query->whereAny($attributes, 'like', "%{$item}%");
          foreach ($matches[0] as $match) {
            $query->orWhereAny($attributes, 'like', "%{$match}%");
          }
        });
      }
    });
    // dd($query->toRawSql());
    $data = $query->get()->toArray() ?? [];
    $results = array_map(fn($value) => [
      ...$value,
    ], $data);

    return response()->json($results);
  }
}
