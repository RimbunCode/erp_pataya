<?php

namespace App\Models\Scopes;

use App\Models\Core\Preference;
use App\Models\Core\SavedFilter;
use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
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

    /**
     * Nama cookie kolom DataTable, unik per-path. HARUS identik dengan sanitizer
     * frontend (Table2.jsx `datatableColumnsCookieKey`): trim slash → lowercase →
     * ganti karakter non-alnum jadi "_". `$request->path()` sudah tanpa leading
     * slash & query string.
     */
    private function datatableColumnsCookieKey(string $path): string {
        $slug = \trim($path, '/');
        $slug = \strtolower($slug);
        $slug = \preg_replace('/[^a-z0-9]+/', '_', $slug);
        $slug = \trim($slug, '_');

        return $slug !== '' ? 'datatable_columns_' . $slug : 'datatable_columns';
    }

    protected function addDataTable(Builder $builder) {
        $builder->macro('dataTable', function (Builder $query, Request $request, ?array $showedColumns = null) {
            $dataTableColumns = \get_class($query->getModel())::getColumns(1);
            // Kolom visible dari cookie (standar Laravel; plaintext krn dikecualikan
            // dari enkripsi di bootstrap/app.php). Nama cookie unik per-path (suffix
            // path ter-sanitize) agar tak bentrok antar-halaman di sebagian browser.
            // Hanya himpunan nama kolom yang dipakai — width & order diabaikan (frontend).
            $cookieRaw   = $request->cookie($this->datatableColumnsCookieKey($request->path()));
            $visibleKeys = \is_string($cookieRaw)
                ? \array_keys(\json_decode($cookieRaw, true) ?: [])
                : null;

            $isSubmitable = $query->getModel()->isSubmitable();
            $nameOfTable  = $query->toBase()->from;
            $defaultShow  = Preference::where('key', 'num_per_page')->first()?->value ?? 25;
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
            $sortKeyRaw    = $sortDirection === 'desc' ? \substr($sort, 1) : $sort;
            $sortKey       = $this->isTableIncluded($sortKeyRaw) ? $sortKeyRaw : "$nameOfTable.$sortKeyRaw";
            $query         = $query->orderBy($sortKey, $sortDirection);

            // Pruning adaptif (strict, tanpa fallbackAll): SELECT hanya kolom visible
            // (+PK+FK relasi+dependsOn append) dan with() hanya relasi visible. Kolom
            // sort lokal non-visible diikutkan via extraKeys agar orderBy tetap valid.
            // templateLink (mobile view convertTemplateLink) di-resolve nested rekursif
            // oleh resolveForSafe → kolom/relasi yang dirujuknya wajib ikut select/with.
            $extraKeys = array_merge(
                $this->isTableIncluded($sortKeyRaw) ? [] : [$sortKeyRaw],
                ['route', 'canDelete', 'keyModel', 'appendStatus', 'thisModel', 'templateLink', 'disabledOn'],
            );
            $modelClass   = \get_class($query->getModel());
            $templateLink = \method_exists($modelClass, 'templateLink') ? $modelClass::templateLink() : null;
            $selector     = new DataTableColumnSelector(new FilterColumnResolver($dataTableColumns));
            // Relasi child index dirender via templateLink child (convertTemplateLink) —
            // ditangani Arah A di resolveForSafe; tak perlu safeRelationColumns eksplisit.
            $safeColumns = $selector->safeColumnsFromVisible($dataTableColumns, $visibleKeys, $extraKeys);
            $resolved    = $selector->resolveForSafe($dataTableColumns, $query->getModel(), $safeColumns, [], $templateLink);

            $query->addSelect(\array_map(fn ($c) => \str_contains($c, '.') ? $c : "$nameOfTable.$c", $resolved['select']));

            // with: map relasi => closure child-select (resolveForSafe) digabung relasi
            // manual dari ?with (tanpa closure). Key map menang bila duplikat.
            $with = $resolved['with'];
            if ($request->has('with')) {
                foreach ((array) $request->with as $k => $v) {
                    $rel = \is_int($k) ? $v : $k;
                    if (\is_string($rel) && ! \array_key_exists($rel, $with)) {
                        $with[$rel] = \is_int($k) ? null : $v;
                    }
                }
            }
            // null entries → eager-load apa adanya (numeric); closure no-op merusak morphTo.
            $query = $query->with(DataTableColumnSelector::withArray($with));
            if ($request->has('id')) {
                $data = $query->find($request->id);
                if ($data instanceof Model) {
                    DataTableColumnSelector::applyAppends($data, $dataTableColumns, $safeColumns);
                }

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
                    // Expand kolom relasi yang dipakai filter agar frontend dapat
                    // me-resolve value tanpa fetch async (hilangkan kedip/lag).
                    $dataTableColumns = (new FilterColumnResolver($dataTableColumns))
                        ->expandColumnsForTree($saved->filter ?? []);
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

            $paginator = $query->paginate($show);
            DataTableColumnSelector::applyAppends($paginator, $dataTableColumns, $safeColumns);
            $data = [
                'data' => $paginator,
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
