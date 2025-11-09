<?php

namespace App\Http\Controllers;

use App\Models\User\User;
use App\Utils;
use Error;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ModelController extends Controller
{
  private function filterOperator(Builder|JoinClause $query, $key, $operatorFilter, $value, $boolean = "and", bool $valueIsColumn = false)
  {
    preg_match('/^([^\[\]]+)/', $operatorFilter, $matches);
    $operatorFilter = $matches[1] ?? "";
    if ($valueIsColumn && \in_array($key, ["column", "in", "notIn", "between", "notBetween"])) {
      new Error("Invalid operator {$operatorFilter} for column {$key}");
    }
    $function = $valueIsColumn ? "whereColumn" : "where";
    switch ($operatorFilter) {
      case 'or':
      case 'and':
        $query->where(function ($builder) use ($key, $value, $operatorFilter, $valueIsColumn) {
          foreach ($value as $operator => $val) {
            $this->filterOperator($builder, $key, $operator, $val, $operatorFilter, valueIsColumn: $valueIsColumn);
          }
        }, boolean: $boolean);
        break;
      case '>':
        $query->$function($key, '>', $value, $boolean);
        break;
      case '>=':
        $query->$function($key, '>=', $value, $boolean);
        break;
      case '<':
        $query->$function($key, '<', $value, $boolean);
        break;
      case '<=':
        $query->$function($key, '<=', $value, $boolean);
        break;
      case 'in':
        $query->whereIn($key, $value, $boolean);
        break;
      case 'notIn':
        $query->whereNotIn($key, $value, $boolean);
        break;
      case 'like':
        $query->$function($key, 'like', "%{$value}%", $boolean);
        break;
      case 'notLike':
        $query->$function($key, 'not like', "%{$value}%", $boolean);
        break;
      case 'between':
        $query->whereBetween($key, $value, $boolean);
        break;
      case 'notBetween':
        $query->whereNotBetween($key, $value, $boolean);
        break;
      case "column":
        if (\is_array($value)) {
          $query->where(function ($query) use ($key, $value) {
            foreach ($value as $operator => $val) {
              $this->filterOperator($query, $key, $operator, $val, "and", valueIsColumn: true);
            }
          }, boolean: $boolean);
        } else {
          $query->whereColumn($key, "=", $value, $boolean);
        }
        break;
      case 'not':
        $query->$function($key, '!=', $value, $boolean);
        break;
      case "=":
      default:
        $query->$function($key, '=', $value, $boolean);
    }
  }
  private function filterToQuery(Builder|JoinClause $query, $filters, $boolean = "and", array &$with = [])
  {
    if ($query instanceof Builder) {
      $columns = Schema::getColumnListing($query->getModel()->getTable());
    }
    foreach ($filters as $key => $value) {
      preg_match('/^([^\[\]]+)/', $key, $matches);
      $key = $matches[1] ?? "";
      switch ($key) {
        case 'or':
        case 'and': {
            $query->where(function ($query) use ($value, $key) {
              $this->filterToQuery($query, $value, $key);
            }, boolean: $boolean);
            break;
          }
        default: {
            $isMatch = \preg_match('/^raw\((.+)\)$/', $key, $matches);
            if ($isMatch) {
              $key = $matches[1];
            }
            if ($query instanceof Builder && !$isMatch && !in_array($key, $columns)) {
              $with[] = $key;
              $query->has($key, ">=", 1, $boolean, function (Builder $builder) use ($value) {
                $this->filterToQuery($builder, $value);
              });
            } else if (is_array($value)) {
              $query->where(function (Builder $builder) use ($key, $value, $boolean) {
                foreach ($value as $operator => $val) {
                  $this->filterOperator($builder, $key, $operator, $val);
                }
              }, boolean: $boolean);
            } else {
              $query->where($key, $value, boolean: $boolean);
            }
            break;
          }
      }
    }
  }
  private function queryTranslations(Builder|JoinClause $query, Request $request, $search, $boolean = "and")
  {
    $hasTranslate = $request->has("translate");
    if ($hasTranslate) {
      $translates = $request->translate;
      $query->where(function (Builder $query) use ($translates, $search) {
        $search = \strtolower($search);
        foreach ($translates as $column => $map) {
          foreach ($map as $value => $keyword) {
            $value = match (\strtolower($value)) {
              "true" => true,
              "false" => false,
              default => $value
            };
            if (\is_string($keyword)) {
              $keyword = \strtolower($keyword);
              if (
                \str_contains($keyword, $search)
              ) {
                $query->orWhere($column, $value);
              }
            } else if (\is_array($keyword)) {
              foreach ($keyword as $val) {
                if (
                  \str_contains($val, $search)
                ) {
                  $query->orWhere($column, $value);
                }
              }
            }
          }
        }
      }, boolean: $boolean);
    }
    return $query;
  }
  public function __invoke(Request $request)
  {
    if ($this->isInertiaRequest($request)) {
      abort(404);
      return;
    }
    $model = $request->model;
    if ($request->has("id")) {
      $dataModel = $model::find($request->id);
      if ($request->has('with')) {
        $dataModel->load($request->with);
      }
      return response()->json($dataModel);
    }
    $search = $request->search ?? "";
    $template = $model::templateLink();
    // Ekstrak daftar atribut dari template
    preg_match_all('/:((\w[\w]+{:[\w]+})|(\w[\w.]*))/', $template, $matches);
    // Hapus tanda `:` agar hanya mendapatkan nama atribut
    $attributes = array_map(
      fn($attr) =>
      preg_replace('/{:.*}/', "", ltrim($attr, ':')),
      $matches[0]
    );
    if ($request->has('keywords')) {
      $attributes = [
        ...$attributes,
        ...$request->keywords,
      ];
    }
    $attributes = collect($attributes)->unique()->toArray();
    if (\method_exists($model, 'scopeLinkModel')) {
      $query = $model::linkModel($search);
    } else {
      $query = $model::where(function (Builder $query) use ($search, $attributes, $request) {
        $splitSearch = explode(" ", $search);
        foreach ($splitSearch as $item) {
          $hasTranslate = $request->has("translate");

          preg_match_all('/[a-zA-Z0-9]+/', $item, $matches);
          // dd($matches, $item, $attributes);

          if (count($matches[0]) == 1 && !Utils::isNullOrWhitespace($item) && $item == $matches[0][0]) {
            $query->whereAny($attributes, 'like', "%{$item}%");
            $this->queryTranslations($query, $request, $item, "or");
            continue;
          }
          if (preg_match('/^[^\w]+$/', $item))
            continue;

          $query->where(function (Builder $query) use ($matches, $item, $attributes, $request) {
            if (!Utils::isNullOrWhitespace($item)) {
              $query->whereAny($attributes, 'like', "%{$item}%");
              $this->queryTranslations($query, $request, $item, "or");
            }
            foreach ($matches[0] as $match) {
              if (Utils::isNullOrWhitespace($match))
                continue;
              $query->orWhereAny($attributes, 'like', "%{$match}%");
              $this->queryTranslations($query, $request, $match, "or");
            }
          });
        }
      });
    }
    if ($request->has('joins')) {
      foreach ($request->joins as $key => $join) {
        $query->select("$key.*");
        if (array_keys($join["on"]) === range(0, count($join["on"]) - 1)) {
          $query->join($key, $join["on"][0], $join["on"][1], $join["on"][2], $join["type"]);
        } else {
          $query->join($key, function (JoinClause $query) use ($join) {
            $query->on(function ($query) use ($join) {
              $this->filterToQuery($query, $join["on"]);
            });
          }, type: $join['type'] ?? 'inner');
        }
      }
      $query->select($model::getTableName() . ".*");
    }
    $with = $request->with ?? [];
    if ($request->has('filters')) {
      $query->where(function (Builder $query) use ($request, &$with) {
        $this->filterToQuery($query, $request->filters ?? [], "and", $with);
      });
    }

    $queryForCount = $query->clone();
    if ($request->has('limit')) {
      $query->limit($request->limit);
    }
    $query->with($with);
    if ($request->has('order')) {
      $orders = explode(":", $request->order);
      $query->orderBy($orders[0], $orders[1] ?? 'asc');
    }

    $data = $query->get()->toArray() ?? [];
    $results = array_map(fn($value) => [
      ...$value,
    ], $data);

    return response()->json([
      'total' => $queryForCount->count(),
      'data' => $results
    ]);
  }

  public function columns(Request $request, string $model)
  {
    // if ($this->isInertiaRequest($request)) {
    //   abort(404);
    //   return;
    // }
    $model = str_replace("/", "\\", $model);
    $showedColumns = $request->columns ?? [];
    $select = $request->select;
    if ($select) {
      $instance = new $model();
      $relation = $instance->$select();
      if ($relation instanceof Relation) {
        $model = \get_class($relation->getRelated());
      }
    }
    $columns = $model::getColumns();
    if (count($showedColumns) > 0) {
      foreach ($columns as $key => $column) {
        $columns[$key]["show"] = false;
        foreach ($showedColumns as $order => $showedCol) {
          if ($column["name"] == $showedCol) {
            $columns[$key]["show"] = true;
            $columns[$key]["order"] = $order;
            break;
          }
        }
      }
    }
    return response()->json([
      'model' => $model,
      'route' => Str::plural((new $model())->getNameClass()),
      'columns' => $columns
    ]);
  }

  public function datatable(Request $request)
  {
    $model = $request->model;
    $showedColumns = $request->showedColumns;

    return $model::dataTable($request, $showedColumns);
  }
}
