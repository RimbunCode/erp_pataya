<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DataTableScope implements Scope {
  /**
   * Apply the scope to a given Eloquent query builder.
   */
  public function apply(Builder $builder, Model $model): void {
    //
  }
  public function extend(Builder $builder) {
    $this->addDataTable($builder);
  }


  protected function addDataTable(Builder $builder) {
    $builder->macro('dataTable', function (Builder $query, Request $request) {
      $show = ((int)($_COOKIE['datatable_show'] ?? 25));
      $show = $show <= 0 ? 25 : $show;
      // Sort
      $sort = $request->input('sort', '-created_at');
      $sortArr = explode("-", $sort);
      $sortKey = end($sortArr);
      $sortDirection = $sortArr[0] === $sortKey ? "asc" : "desc";
      $query = $query->orderBy($sortKey, $sortDirection);

      // Filter
      if ($request->has('f')) {
        $filter = $request->input('f');
        $query->where(function (Builder $query) use ($filter) {
          foreach ($filter as $key => $payload) {
            $operator = $payload[1];
            $value = match ($payload[2]) {
              'true' => true,
              'false' => false,
              default => $payload[2]
            };
            if (in_array($operator, ['in', '!in'])) {
              $values = array_map(function ($val) {
                return trim($val);
              },  explode(',', $value));
              $query->whereIn($payload[0], $values, $key <= 0 ? 'and' : 'or', $operator == '!like');
            } else if (in_array($operator, ['between', '!between'])) {
              $values = array_map(function ($val) {
                return trim($val);
              },  explode(',', $value));
              $query->whereBetween($payload[0], $values, $key <= 0 ? 'and' : 'or', $operator == '!like');
            } else {
              $operator = match ($payload[1]) {
                'eq' => '=',
                '!eq' => '!=',
                'like' => 'like',
                '!like' => 'not like',
                default => $payload[1]
              };
              $query->where($payload[0], $operator, $value, $key <= 0 ? 'and' : 'or');
            }
          };
        });
      }

      // dd($query->toRawSql());
      Inertia::share([
        'defaultSort' => '-created_at',
        'data' => Inertia::merge($query->paginate($show))
      ]);
    });
  }
}
