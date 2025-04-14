<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ModelController extends Controller {

  private function filterOperator(Builder $query, $key, $operator, $value) {

    switch ($operator) {
      case 'or':
      case 'and':
        $query->where(function (Builder $builder) use ($key, $value) {
          foreach ($value as $operator => $val) {
            $this->filterOperator($builder, $key, $operator, $val);
          }
        }, $operator);
        break;
      case 'not':
        $query->where($key, '!=', $value);
        break;
      case '=':
        $query->where($key, '=', $value);
      case '>':
        $query->where($key, '>', $value);
        break;
      case '>=':
        $query->where($key, '>=', $value);
        break;
      case '<':
        $query->where($key, '<', $value);
        break;
      case '<=':
        $query->where($key, '<=', $value);
        break;
      case 'in':
        $query->whereIn($key, $value);
        break;
      case 'notIn':
        $query->whereNotIn($key, $value);
        break;
      case 'like':
        $query->where($key, 'like', "%{$value}%");
        break;
      case 'notLike':
        $query->where($key, 'not like', "%{$value}%");
        break;
      case 'between':
        $query->whereBetween($key, $value);
        break;
      case 'notBetween':
        $query->whereNotBetween($key, $value);
        break;
    }
  }
  private function filterToQuery(Builder $query, $filters) {
    foreach ($filters as $key => $value) {
      switch ($key) {
        case 'or':
        case 'and': {
            $query->where(function (Builder $query) use ($value) {
              $this->filterToQuery($query, $value);
            }, $key);
            break;
          }
        default: {
            if (is_array($value)) {
              $query->where(function (Builder $builder) use ($key, $value) {
                foreach ($value as $operator => $val) {
                  $this->filterOperator($builder, $key, $operator, $val);
                }
              });
              return;
            }
            $query->where($key, $value);
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
    preg_match_all('/:(\w[\w.]*)/', $template, $matches);
    // Hapus tanda `:` agar hanya mendapatkan nama atribut
    $attributes = array_map(fn($attr) => ltrim($attr, ':'), $matches[0]);
    if (\method_exists($model, 'scopeLinkModel')) {
      $query = $model::linkModel($search);
    } else {
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
    }
    if ($request->has('filters')) {
      $query->where(function (Builder $query) use ($request) {
        $this->filterToQuery($query, $request->filters);
      });
    }
    if ($request->has('limit')) {
      $query->limit($request->limit);
    }

    $data = $query->get()->toArray() ?? [];
    $results = array_map(fn($value) => [
      ...$value,
    ], $data);

    return response()->json($results);
  }
}
