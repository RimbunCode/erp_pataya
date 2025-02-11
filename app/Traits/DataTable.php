<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Request;

trait DataTable {
  public static function dataTable(Builder $query, Request $request) {
    // Sort
    $sort = $request->input('sort', '-created_at');
    $sortArr = explode("-", $sort);
    $sortKey = end($sortArr);
    $sortDirection = $sortArr[0] === $sortKey ? "asc" : "desc";
    $query = $query->orderBy($sortKey, $sortDirection);

    // Filter
    if ($request->has('f')) {
      $filter = $request->input('f');
      $filter->each(function ($value, $key) use ($query) {
      });
      if (is_array($filter)) {
        $operator = $filter[0];
        $value = $filter[1];
      }
    }

    return $query;
  }
}
