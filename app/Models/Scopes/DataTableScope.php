<?php

namespace App\Models\Scopes;

use App\Models\Core\Preference;
use App\Utils;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DataTableScope implements Scope {
  /**
   * Apply the scope to a given Eloquent query builder.
   */
  public function apply(Builder $builder, \Illuminate\Database\Eloquent\Model $model): void {
    //
  }

  public function extend(Builder $builder) {
    $this->addDataTable($builder);
  }

  private function isTableIncluded($columnReference) {
    return preg_match('/^\w+\.\w+$/', $columnReference);
  }

  protected function addDataTable(Builder $builder) {
    $builder->macro('dataTable', function (Builder $query, Request $request, array|null $showedColumns = null) {
      $dataTableColumns = \get_class($query->getModel())::getColumns();
      $configColumns    = array_column(\json_decode($_COOKIE['datatable_columns'] ?? "", true) ?? [], null, "name");

      $isSubmitable = $query->getModel()->isSubmitable();
      $nameOfTable  = $query->toBase()->from;
      $query->addSelect("$nameOfTable.*");
      $defaultShow = Preference::where('key', 'num_per_page')->first()?->value ?? 25;
      $show        = (int) ($_COOKIE['datatable_show'] ?? $defaultShow);
      $show        = $show <= 0 ? 25 : $show;
      // Sort
      $sort          = $request->input('sort', '-created_at');
      $sortArr       = explode("-", $sort);
      $sortKey       = end($sortArr);
      $sortKey       = $this->isTableIncluded($sortKey) ? $sortKey : "$nameOfTable.$sortKey";
      $sortDirection = $sortArr[0] === $sortKey ? "asc" : "desc";
      $query         = $query->orderBy($sortKey, $sortDirection);

      $relations = [];
      foreach ($dataTableColumns as $column) {
        if ($column["ignore"] ?? false)
          continue;
        if ($column["type"] == "relation") {
          $relations[] = $column["nameOfFunction"];
        }
      }
      $with = $relations;
      if ($request->has("with")) {
        $with = [
          ...$with,
          ...$request->with,
        ];
      }
      $query = $query->with($with);
      if ($request->has('id')) {
        $data = $query->find($request->id);

        return [
          'data'             => $data,
          'dataTableColumns' => $dataTableColumns,
        ];
      }
      // Filter
      if ($request->has('f')) {
        $filter = $request->input('f');
        $query->where(function (Builder $query) use ($filter, $nameOfTable) {
          foreach ($filter as $key => $payload) {
            $keyQuery = $this->isTableIncluded($payload[0]) ? $payload[0] : "$nameOfTable.$payload[0]";
            $operator = $payload[1];
            $value    = match ($payload[2]) {
              'true'  => true,
              'false' => false,
              default => $payload[2]
            };
            if (in_array($operator, ['in', '!in'])) {
              $values = array_map(function ($val) {
                return trim($val);
              }, explode(',', $value));
              $query->whereIn($keyQuery, $values, $key <= 0 ? 'and' : 'or', $operator == '!like');
            } else if (in_array($operator, ['between', '!between'])) {
              if (is_array($value) && count($value) == 2) {
                $query->whereBetween($keyQuery, \array_values($value), $key <= 0 ? 'and' : 'or', $operator == '!like');
              } else {
                $values = array_map(function ($val) {
                  return trim($val);
                }, explode(',', $value));
                $query->whereBetween($keyQuery, $values, $key <= 0 ? 'and' : 'or', $operator == '!like');
              }
            } else {
              $operator = match ($payload[1]) {
                'eq'    => '=',
                '!eq'   => '!=',
                'like'  => 'like',
                '!like' => 'not like',
                default => $payload[1]
              };
              $query->where($keyQuery, $operator, $value, $key <= 0 ? 'and' : 'or');
            }
          };
        });
      }
      if ($isSubmitable) {
        $query->where(function (Builder $query) use ($request) {
          $query->whereNotNull('submitted_at');
          $query->orWhere('created_by', $request->user()->id);
        });
      }

      $data = [
        'data' => $query->paginate($show),
      ];
      if (! Utils::isInertiaRequest($request)) {
        return $data;
      }
      Inertia::share([
        ...$data,
        'defaultSort'      => '-created_at',
        'name'             => $query->getModel()->getNameClass(),
        'translateKey'     => $query->getModel()->translateKey ?? null,
        'dataTableColumns' => $dataTableColumns,
      ]);
    });
  }
}
