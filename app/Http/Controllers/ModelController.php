<?php

namespace App\Http\Controllers;

use App\Models\User\User;
use App\Utils;
use Error;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModelController extends Controller {
  private function filterOperator(Builder|JoinClause $query, $key, $operatorFilter, $value, $boolean = "and", bool $valueIsColumn = false) {
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
  private function filterToQuery(Builder|JoinClause $query, $filters, $boolean = "and") {
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
              $query->has($key, ">=", 1, $boolean, function (Builder $builder) use ($value) {
                $this->filterToQuery($builder, $value);
              });
            } else if (is_array($value)) {
              $query->where(function ($builder) use ($key, $value, $boolean) {
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
  public function __invoke(Request $request) {
    if ($this->isInertiaRequest($request)) {
      abort(404);
      return;
    }
    $model = $request->model;
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
      $query = $model::where(function (Builder $query) use ($search, $attributes) {
        $splitSearch = explode(" ", $search);
        foreach ($splitSearch as $item) {
          preg_match_all('/[a-zA-Z0-9]+/', $item, $matches);

          if (count($matches[0]) == 1 && !Utils::isNullOrWhitespace($item) && $item == $matches[0][0]) {
            $query->whereAny($attributes, 'like', "%{$item}%");
            continue;
          }
          if (preg_match('/^[^\w]+$/', $item))
            continue;

          $query->where(function (Builder $query) use ($matches, $item, $attributes) {
            if (!Utils::isNullOrWhitespace($item)) {
              $query->whereAny($attributes, 'like', "%{$item}%");
            }
            foreach ($matches[0] as $match) {
              if (Utils::isNullOrWhitespace($match))
                continue;
              $query->orWhereAny($attributes, 'like', "%{$match}%");
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
    if ($request->has('filters')) {
      $query->where(function (Builder $query) use ($request) {
        $this->filterToQuery($query, $request->filters);
      });
    }
    // dd($query->toRawSql());
    if ($request->has('limit')) {
      $query->limit($request->limit);
    }
    if ($request->has('with')) {
      $query->with($request->with);
    }
    if ($request->has('order')) {
      $orders = explode(":", $request->order);
      $query->orderBy($orders[0], $orders[1] ?? 'asc');
    }

    $data = $query->get()->toArray() ?? [];
    $results = array_map(fn($value) => [
      ...$value,
    ], $data);

    User::join("roles", function ($query) {
    });
    return response()->json($results);
  }
}
