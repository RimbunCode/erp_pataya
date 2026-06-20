<?php

namespace App\Http\Controllers;

use App\Services\Core\FilterEvaluator;
use App\Services\Core\LinkModelFilterConverter;
use App\Utils;
use Error;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ModelController extends Controller {
    private function filterOperator(Builder|JoinClause $query, $key, $operatorFilter, $value, $boolean = 'and', bool $valueIsColumn = false) {
        preg_match('/^([^\[\]]+)/', $operatorFilter, $matches);
        $operatorFilter = $matches[1] ?? '';
        if ($valueIsColumn && \in_array($key, ['column', 'in', 'notIn', 'between', 'notBetween'])) {
            new Error("Invalid operator {$operatorFilter} for column {$key}");
        }
        $function = $valueIsColumn ? 'whereColumn' : 'where';
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
            case 'jsonContains':
                $query->whereRaw("json_overlaps($key, ?)", [json_encode($value)], $boolean);
                // dd($query->toRawSql());
                break;
            case 'jsonDoesntContains':
                $query->whereRaw("not json_overlaps($key, ?)", [json_encode($value)], $boolean);
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
            case 'column':
                if (\is_array($value)) {
                    $query->where(function ($query) use ($key, $value) {
                        foreach ($value as $operator => $val) {
                            $this->filterOperator($query, $key, $operator, $val, 'and', valueIsColumn: true);
                        }
                    }, boolean: $boolean);
                } else {
                    $query->whereColumn($key, '=', $value, $boolean);
                }
                break;
            case '!=':
            case 'notEqual':
            case 'not':
                $query->$function($key, '!=', $value, $boolean);
                break;
            case '==':
            case 'equal':
            default:
                $query->$function($key, '=', $value, $boolean);
        }
    }

    private function applyLinkModelFilters(Builder $query, array $filters): void {
        $columns = $query->getModel()::getColumns(1);
        $tree    = (new LinkModelFilterConverter($columns))->toTree($filters);
        (new FilterEvaluator($columns))->apply($query, $tree);
    }

    private function filterToQuery(Builder|JoinClause $query, $filters, $boolean = 'and', array &$with = []) {
        if ($query instanceof Builder) {
            $columns = Schema::getColumnListing($query->getModel()->getTable());
        }
        foreach ($filters as $key => $value) {
            preg_match('/^([^\[\]]+)/', $key, $matches);
            $key = $matches[1] ?? '';
            switch ($key) {
                case 'or':
                case 'and':
                    $query->where(function ($query) use ($value, $key) {
                        $this->filterToQuery($query, $value, $key);
                    }, boolean: $boolean);
                    break;

                default:
                    $isMatch = \preg_match('/^raw\((.+)\)$/', $key, $matches);
                    if ($isMatch) {
                        $key = $matches[1];
                    }
                    if ($query instanceof Builder && ! $isMatch && ! in_array($key, $columns)) {
                        $with[] = $key;
                        $query->has($key, '>=', 1, $boolean, function (Builder $builder) use ($value) {
                            $this->filterToQuery($builder, $value);
                        });
                    } elseif (\is_array($value)) {
                        $query->where(function (Builder $builder) use ($key, $value) {
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

    private function queryTranslations(Builder|JoinClause $query, Request $request, $search, $boolean = 'and', bool $useTranslate = true) {
        if (! $useTranslate) {
            return $query;
        }
        $hasTranslate = $request->has('translate');
        if ($hasTranslate) {
            $translates = $request->translate;
            $query->where(function (Builder $query) use ($translates, $search) {
                $search = \strtolower($search);
                foreach ($translates as $column => $map) {
                    foreach ($map as $value => $keyword) {
                        $value = match (\strtolower($value)) {
                            'true'  => true,
                            'false' => false,
                            default => $value,
                        };
                        if (\is_string($keyword)) {
                            $keyword = \strtolower($keyword);
                            if (
                                \str_contains($keyword, $search)
                            ) {
                                $query->orWhere($column, $value);
                            }
                        } elseif (\is_array($keyword)) {
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

    public function __invoke(Request $request) {
        if ($this->isInertiaRequest($request)) {
            abort(404);

            return;
        }
        $isCache = $request->boolean('cacheMode');
        $model   = $request->model;
        if ($request->has('id')) {
            $dataModel = $model::find($request->id);
            if ($request->has('with')) {
                $dataModel->load($request->with);
            }

            return response()->json($dataModel);
        }
        $search   = $isCache ? '' : ($request->search ?? '');
        $template = $model::templateLink();
        // Ekstrak daftar atribut dari template
        preg_match_all('/:((\w[\w]+{:[\w]+})|(\w[\w.]*))/', $template, $matches);
        if (! $isCache) {
            if ($request->has('keywords')) {
                $attributes = $request->keywords;
            } else {
                // Hapus tanda `:` agar hanya mendapatkan nama atribut
                $attributes = array_map(
                    fn ($attr) => preg_replace('/{:.*}/', '', ltrim($attr, ':')),
                    $matches[0],
                );
            }
            $attributes = collect($attributes)->unique()->toArray();
            if (\method_exists($model, 'scopeLinkModel')) {
                $query = $model::linkModel($search);
            } else {
                $query = $model::where(function (Builder $query) use ($search, $attributes, $request, $isCache) {
                    $splitSearch = explode(' ', $search);
                    foreach ($splitSearch as $item) {
                        $hasTranslate = ! $isCache && $request->has('translate');

                        preg_match_all('/[a-zA-Z0-9]+/', $item, $matches);

                        if (count($matches[0]) == 1 && ! Utils::isNullOrWhitespace($item) && $item == $matches[0][0]) {
                            $query->whereAny($attributes, 'like', "%{$item}%");
                            $this->queryTranslations($query, $request, $item, 'or', ! $isCache);

                            continue;
                        }
                        if (preg_match('/^[^\w]+$/', $item)) {
                            continue;
                        }

                        $query->where(function (Builder $query) use ($matches, $item, $attributes, $request, $isCache) {
                            if (! Utils::isNullOrWhitespace($item)) {
                                $query->whereAny($attributes, 'like', "%{$item}%");
                                $this->queryTranslations($query, $request, $item, 'or', ! $isCache);
                            }
                            foreach ($matches[0] as $match) {
                                if (Utils::isNullOrWhitespace($match)) {
                                    continue;
                                }
                                $query->orWhereAny($attributes, 'like', "%{$match}%");
                                $this->queryTranslations($query, $request, $match, 'or', ! $isCache);
                            }
                        });
                    }
                });
            }

        } else {
            $query = $model::query();
        }
        $with = $request->with ?? [];
        $with = $isCache ? ($model::getRelationKeys(relations: $with) ?? []) : $with;

        if ($request->has('joins')) {
            foreach ($request->joins as $key => $join) {
                if (isset($join['columns'])) {
                    foreach ($join['columns'] as $column) {
                        $query->addSelect("$key.$column");
                    }
                } else {
                    $query->addSelect("$key.*");
                }
                if (array_keys($join['on']) === range(0, count($join['on']) - 1)) {
                    $query->join($key, $join['on'][0], $join['on'][1], $join['on'][2], $join['type'] ?? 'inner');
                } else {
                    $query->join($key, function (JoinClause $query) use ($join) {
                        $query->on(function ($query) use ($join) {
                            $this->filterToQuery($query, $join['on']);
                        });
                    }, type: $join['type'] ?? 'inner');
                }
            }
            $query->addSelect($model::getTableName() . '.*');
        }
        if (! $isCache && $request->has('filters')) {
            $query->where(function (Builder $query) use ($request) {
                $this->applyLinkModelFilters($query, $request->filters ?? []);
            });
        }

        $queryForCount = $query->clone();
        if (! $isCache && $request->has('limit')) {
            $query->limit($request->limit);
        }
        $query->with($with);
        if ($request->has('order')) {
            $orders = explode(':', $request->order);
            $query->orderBy($orders[0], $orders[1] ?? 'asc');
        }
        $data    = $query->get()->toArray() ?? [];
        $results = array_map(fn ($value) => [
            ...$value,
        ], $data);

        return response()->json([
            'total' => $queryForCount->count(),
            'data'  => $results,
        ]);
    }

    public function selectData(Request $request) {
        $parent = \str_replace('/', '\\', (string) $request->model);
        if (! \class_exists($parent) || ! \is_subclass_of($parent, Model::class)) {
            return response()->json(['message' => 'Model class not found'], 422);
        }

        $target       = $parent;
        $parentColumn = null;
        if ($select = $request->select) {
            if (! \method_exists($parent, $select)) {
                return response()->json(['message' => "Relation '{$select}' does not exist"], 422);
            }
            $relation = (new $parent)->$select();
            if (! $relation instanceof Relation) {
                return response()->json(['message' => "Relation '{$select}' does not exist"], 422);
            }
            $target = \get_class($relation->getRelated());

            // per-item: eager-load relasi balik parent + tandai kolomnya.
            if ($parentRel = $target::$parentRelation ?? null) {
                $request->merge(['with' => \array_values(\array_unique([...($request->with ?? []), $parentRel]))]);
                $parentColumn = Str::snake($parentRel);
            }
        }

        $columns       = $target::getColumns(1);
        $showedColumns = $request->columns ?? [];

        // Per-item: relasi parent kerap ber-`ignore:true` di configColumns (mis.
        // WorkOrderItem::workOrder) sehingga getColumns membuangnya. Re-inject entri
        // kolom relasi parent agar (a) tampil di metadata, dan (b) terlihat sbg
        // relasi visible oleh adaptive-select macro (collectRelation → eager-load
        // parent + SELECT FK). Tanpa ini, parentColumn ada tapi data parent null.
        if ($parentColumn && ! isset($columns[$parentColumn])) {
            // nameOfFunction = relasi balik di model TARGET (child) menuju parent
            // (mis. WorkOrderItem::workOrder) — bukan $select (relasi parent→child).
            // adaptive-select memanggil $target->{$parentRel}() untuk ambil FK.
            $columns[$parentColumn] = [
                'name'           => $parentColumn,
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => $parentRel,
                'related'        => $parent,
                'route'          => null,
                'sortable'       => false,
                'searchable'     => true,
                'show'           => true,
                'primaryKey'     => (new $parent)->getKeyName(),
                'titleTrans'     => (new $target)->translateKey
                    ? (new $target)->translateKey . '.columns.' . $parentColumn
                    : null,
                'columns' => [],
            ];
        }

        foreach ($columns as $key => $column) {
            // un-ignore kolom parent (per-item) walau ter-ignore di configColumns.
            if ($parentColumn && $column['name'] === $parentColumn) {
                $columns[$key]['show'] = true;
            }
            if (\count($showedColumns) > 0 && $column['name'] !== $parentColumn) {
                $columns[$key]['show'] = false;
                foreach ($showedColumns as $order => $showedCol) {
                    if ($column['name'] === $showedCol) {
                        $columns[$key]['show']  = true;
                        $columns[$key]['order'] = $order;
                        break;
                    }
                }
            }
        }

        // Tiga jalur filter (semua AND): baseFilters (tree LinkModel) + filters
        // ({root:{k,o,v,c}} native) di sini; fid/sort/paginate/submitable via macro.
        $query = $target::query();

        // Per-item: macro `dataTable` membangun ulang kolom via getColumns(1)
        // (mengabaikan re-inject di atas) sehingga adaptive-select tak tahu perlu
        // FK relasi parent yang ber-`ignore:true`. SELECT FK eksplisit di sini agar
        // belongsTo parent dapat di-resolve (addSelect akumulatif dgn macro).
        if ($parentColumn && isset($parentRel)) {
            $parentRelation = (new $target)->{$parentRel}();
            if ($parentRelation instanceof BelongsTo) {
                $targetTable = (new $target)->getTable();
                $query->addSelect("{$targetTable}.{$parentRelation->getForeignKeyName()}");
            }
        }

        if ($baseFilters = $request->baseFilters) {
            $this->applyLinkModelFilters($query, $baseFilters);
        }
        if ($filters = $request->filters) {
            (new FilterEvaluator($columns))->apply($query, $filters);
        }
        $result = $query->dataTable($request, $showedColumns);

        return response()->json([
            'model'        => $target,
            'route'        => Str::plural((new $target)->getNameClass()),
            'translateKey' => (new $target)->translateKey ?? null,
            'columns'      => $columns,
            'parentColumn' => $parentColumn,
            'data'         => $result['data'],
        ]);
    }

    public function columns(Request $request, string $model) {
        // if ($this->isInertiaRequest($request)) {
        //   abort(404);
        //   return;
        // }
        $oriModel      = str_replace('/', '\\', $model);
        $showedColumns = $request->columns ?? [];
        $select        = $request->select;
        if ($select) {
            $instance = new $oriModel;
            $relation = $instance->$select();
            if ($relation instanceof Relation) {
                $model = \get_class($relation->getRelated());
            }
        }
        $columns = $model::getColumns(1);
        if (count($showedColumns) > 0) {
            foreach ($columns as $key => $column) {
                $columns[$key]['show'] = false;
                foreach ($showedColumns as $order => $showedCol) {
                    if ($column['name'] == $showedCol) {
                        $columns[$key]['show']  = true;
                        $columns[$key]['order'] = $order;
                        break;
                    }
                }
            }
        }

        return response()->json([
            'model'   => $model,
            'route'   => Str::plural((new $model)->getNameClass()),
            'columns' => $columns,
        ]);
    }

    public function datatable(Request $request) {
        $model         = $request->model;
        $showedColumns = $request->showedColumns;

        return $model::dataTable($request, $showedColumns);
    }
}
