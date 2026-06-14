<?php

namespace App\Models\Scopes;

use App\Models\Core\Preference;
use App\Models\Core\SavedFilter;
use App\Services\Core\FilterEvaluator;
use App\Utils;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
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

    private function isTableIncluded($columnReference) {
        return preg_match('/^\w+\.\w+$/', $columnReference);
    }

    protected function addDataTable(Builder $builder) {
        $builder->macro('dataTable', function (Builder $query, Request $request, ?array $showedColumns = null) {
            $dataTableColumns = \get_class($query->getModel())::getColumns(1);
            $configColumns    = array_column(\json_decode($_COOKIE['datatable_columns'] ?? '', true) ?? [], null, 'name');

            $isSubmitable = $query->getModel()->isSubmitable();
            $nameOfTable  = $query->toBase()->from;
            $query->addSelect("$nameOfTable.*");
            $defaultShow = Preference::where('key', 'num_per_page')->first()?->value ?? 25;
            // Prioritas: query param `show` > cookie `datatable_show` > default preference.
            $showFromQuery = $request->input('show');
            $show          = (int) ($showFromQuery ?? $request->cookie('datatable_show') ?? $defaultShow);
            $show          = $show <= 0 ? 25 : $show;
            // Kalau `show` datang dari query param, persist ke cookie pada path yang
            // diakses agar konsisten di kunjungan berikutnya tanpa query param.
            if ($showFromQuery !== null) {
                Cookie::queue(
                    Cookie::make('datatable_show', (string) $show, 60 * 24 * 7, '/' . ltrim($request->path(), '/')),
                );
            }
            // Sort — konvensi: prefix `-` = descending, tanpa prefix = ascending.
            // Parse via str_starts_with agar key ber-dash / nested tetap utuh.
            $sort          = $request->input('sort', '-created_at');
            $sortDirection = \str_starts_with($sort, '-') ? 'desc' : 'asc';
            $sortKey       = $sortDirection === 'desc' ? \substr($sort, 1) : $sort;
            $sortKey       = $this->isTableIncluded($sortKey) ? $sortKey : "$nameOfTable.$sortKey";
            $query         = $query->orderBy($sortKey, $sortDirection);

            $relations = [];
            foreach ($dataTableColumns as $column) {
                if ($column['ignore'] ?? false) {
                    continue;
                }
                if ($column['type'] == 'relation') {
                    $relations[] = $column['nameOfFunction'];
                }
            }
            $with = $relations;
            if ($request->has('with')) {
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
            // Filter — saved filter (nested tree) via ?fid=<id>.
            // Akses by-id terbuka (tanpa cek owner); cocokkan model halaman.
            if ($request->filled('fid')) {
                $saved      = SavedFilter::find($request->input('fid'));
                $modelClass = \get_class($query->getModel());
                if ($saved && $saved->model === $modelClass) {
                    (new FilterEvaluator($dataTableColumns))
                        ->apply($query, $saved->filter ?? []);
                }
            }
            if ($isSubmitable) {
                $query->where(function (Builder $query) use ($request) {
                    $query->whereNotNull('submitted_at');
                    $query->orWhere('created_by_id', $request->user()->id);
                });
                if ($request->onlyCreator) {
                    $query->where('created_by_id', $request->user()->id);
                }
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
