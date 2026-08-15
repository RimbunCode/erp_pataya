<?php

namespace App\Http\Controllers;

use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
use App\Services\Core\FilterEvaluator;
use App\Services\Core\LinkModelFilterConverter;
use App\Services\Core\PermissionChecker;
use App\Utils;
use Error;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ModelController extends Controller {
    /**
     * Atribut meta appends (LinkModel::getArrayableAppends) yang BUKAN kolom data
     * tapi dibutuhkan komponen LinkModel/SelectModel (navigasi, render label, state UI).
     * Selalu lolos pembatasan kolom lookup.
     */
    private const ALWAYS_ALLOWED_ATTRIBUTES = [
        'route', 'canDelete', 'canUpdate', 'keyModel', 'appendStatus', 'thisModel', 'templateLink', 'disabledOn',
    ];

    private array $safeColumnsCache     = [];
    private array $relatedModelMapCache = [];

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
        // includeHidden=true: sertakan FK (ber-flag hidden/searchable:false) agar
        // FilterColumnResolver dapat me-resolve filter atas FK. FilterEvaluator
        // dijalankan dgn allowNonSearchable=true sehingga FK yg searchable:false
        // tetap lolos whitelist. Kolom ini TIDAK dikembalikan ke response (UI).
        $columns = $query->getModel()::getColumns(1, true);
        $tree    = (new LinkModelFilterConverter($columns))->toTree($filters);
        (new FilterEvaluator($columns, true))->apply($query, $tree);
    }

    /**
     * Nama kolom yang dirujuk templateLink model. Token bisa:
     *   :name                  → search & display dari `name`
     *   :name{:title}          → search dari `name`, display dari `title`
     *   :relation.col          → relasi (segmen pertama = nama relasi)
     * Untuk `:name{:title}` KEDUA kolom (search `name` + display `title`) harus
     * lolos lookup. Tiap kolom diambil segmen pertamanya (relasi-safe; kolom anak
     * relasi dibatasi rekursi).
     *
     * @return list<string>
     */
    private function templateLinkColumns(string $model): array {
        if (! \method_exists($model, 'templateLink')) {
            return [];
        }
        \preg_match_all('/:((\w[\w]+{:[\w.]+})|(\w[\w.]*))/', (string) $model::templateLink(), $matches);

        $names = [];
        foreach ($matches[0] ?? [] as $token) {
            $token = \ltrim($token, ':');
            // bagian display dalam {:...}
            if (\preg_match('/{:([\w.]+)}/', $token, $m)) {
                $names[] = \explode('.', $m[1])[0];
            }
            // bagian search/utama (sebelum {})
            $search  = \preg_replace('/{:.*}/', '', $token);
            $names[] = \explode('.', $search)[0];
        }

        return \array_values(\array_unique(\array_filter($names, fn ($n) => $n !== '')));
    }

    /**
     * Himpunan nama kolom yang AMAN dikembalikan lookup untuk sebuah model:
     *   templateLink + id + (requested ∩ linkable) − (visibleFor gagal izin).
     * Relasi (type relation/relations) yang diminta/ditemplate diizinkan sbg key
     * agar payload relasi tetap ada (kolom anaknya dibatasi rekursif saat map data).
     *
     * @param  list<string>  $requested  kolom yang diminta form (fields/columns)
     * @param  list<string>  $withRelations  relasi top-level diminta lewat `with` (eager-load)
     * @return array<string,bool> set nama kolom aman (key)
     */
    private function safeLookupColumns(string $model, array $requested, PermissionChecker $perm, array $withRelations = [], bool $includeAllLinkable = false): array {
        $cacheKey = $model . ':' . md5(serialize($requested) . serialize($withRelations));
        if (isset($this->safeColumnsCache[$cacheKey])) {
            return $this->safeColumnsCache[$cacheKey];
        }

        $columns = $model::getColumns(1);
        $byName  = [];
        foreach ($columns as $col) {
            if (isset($col['name'])) {
                $byName[$col['name']] = $col;
            }
        }

        $safe = [];
        // id + primary key selalu (untuk identitas opsi dropdown).
        $safe[(new $model)->getKeyName()] = true;
        $safe['id']                       = true;

        // Atribut meta appends (LinkModel::getArrayableAppends) — bukan kolom data,
        // melainkan meta yang LinkModel/SelectModel butuh utk navigasi/render. Selalu lolos.
        foreach (self::ALWAYS_ALLOWED_ATTRIBUTES as $attr) {
            $safe[$attr] = true;
        }

        // templateLink.
        foreach ($this->templateLinkColumns($model) as $name) {
            $safe[$name] = true;
        }

        // Wildcard "*": expand ke semua nama kolom — linkable & visibleFor tetap dievaluasi.
        if (\in_array('*', $requested, true)) {
            $requested = \array_keys($byName);
        }

        $requestedSet = \array_flip($requested);
        $withSet      = \array_flip($withRelations);
        foreach ($byName as $name => $col) {
            $type       = $col['type'] ?? null;
            $isRelation = \in_array($type, ['relation', 'relations'], true);

            // Relasi: izinkan sbg key bila diminta langsung, diminta lewat field
            // dot-notation (mis. "items.price" → izinkan "items"), sudah di
            // templateLink, atau diminta lewat `with` (eager-load) DAN ber-linkable.
            // Kolom anaknya dibatasi rekursif.
            if ($isRelation) {
                $hasDotField = false;
                foreach ($requested as $f) {
                    if (\str_starts_with((string) $f, $name . '.')) {
                        $hasDotField = true;
                        break;
                    }
                }
                // `with` adalah kontrak relasi eksplisit dari form (eager-load): relasi
                // yang diminta lolos sbg key TANPA syarat `linkable` (linkable adalah
                // gate kolom skalar, bukan relasi). Kolom ANAK relasi tetap disaring
                // rekursif (safeRelationColumns/filterRowColumns) sesuai aturan kolom.
                if (isset($requestedSet[$name]) || isset($safe[$name]) || $hasDotField || isset($withSet[$name])) {
                    // Gate visibleFor (bila ada): jangan loloskan relasi sensitif
                    // ke user yang tak memenuhi izin.
                    if (! empty($col['visibleFor']) && ! $perm->satisfies((array) $col['visibleFor'])) {
                        continue;
                    }
                    $safe[$name] = true;
                }

                continue;
            }

            // Kolom non-relasi di luar templateLink: harus linkable atau forceSelect.
            // linkable di luar cache mode juga harus diminta eksplisit lewat $requested
            // (fields dari client). forceSelect selalu lolos tanpa syarat itu.
            if (! isset($safe[$name])) {
                $isForceSelect = ($col['forceSelect'] ?? false) === true;
                if (! $isForceSelect) {
                    $isLinkable = ($col['linkable'] ?? false) === true;
                    if (! $isLinkable) {
                        continue;
                    }
                    if (! $includeAllLinkable && ! isset($requestedSet[$name])) {
                        continue;
                    }
                }
            }

            // Gate visibleFor (bila ada): buang bila user tak memenuhi.
            if (! empty($col['visibleFor']) && ! $perm->satisfies((array) $col['visibleFor'])) {
                unset($safe[$name]);

                continue;
            }

            $safe[$name] = true;
        }

        return $this->safeColumnsCache[$cacheKey] = $safe;
    }

    /**
     * Subset `$fields` dot-notation yang berada DI BAWAH relasi `$rel`, dengan
     * prefiks relasi dilepas. Mis. fields ["items.price","items.tax.rate","code"],
     * rel "items" → ["price","tax.rate"]. Untuk membatasi kolom relasi sesuai
     * kebutuhan form (multi-level via dot).
     *
     * @param  list<string>  $fields
     * @return list<string>
     */
    private function relationFields(array $fields, string $rel): array {
        $prefix = $rel . '.';
        $out    = [];
        foreach ($fields as $f) {
            if (\str_starts_with((string) $f, $prefix)) {
                $out[] = \substr((string) $f, \strlen($prefix));
            }
        }

        return $out;
    }

    /**
     * Saring satu row hasil toArray() ke kolom aman; relasi yang ikut di-load
     * dibatasi rekursif memakai kolom aman model relasinya. Kolom relasi dibatasi
     * sesuai `$fields` dot-notation (mis. "items.price"). Relasi pada `$passthrough`
     * (mis. parentColumn per-item) diteruskan apa adanya — kolom dokumen induk yang
     * sengaja di-surface, bukan lookup bebas.
     *
     * `$withRelationPaths` (path relasi mentah dari request `with`, dot-notation
     * snake per segmen) diturunkan rekursif spt `$fields` — relasi BERTINGKAT (mis.
     * `items.item`) yang di-eager-load via `with` harus tetap lolos gate `$safe`
     * child, bukan cuma level pertamanya. Tanpa ini, relasi cucu yang SUDAH
     * ter-hydrate DB tetap dibuang di lapis kedua ini (mismatch dgn SELECT-level).
     *
     * @param  array<string,mixed>  $row
     * @param  array<string,bool>  $safe  set kolom aman model ini
     * @param  array<string,string>  $relatedModels  nameRelasi → FQCN model relasi
     * @param  list<string>  $fields  kolom diminta (dot-notation utk relasi)
     * @param  array<string,bool>  $passthrough  nama relasi yang TIDAK dibatasi kolom-anaknya
     * @param  list<string>  $withRelationPaths  path relasi mentah diminta `with` (dot-notation)
     */
    private function filterRowColumns(array $row, array $safe, array $relatedModels, PermissionChecker $perm, array $fields = [], array $passthrough = [], array $withRelationPaths = []): array {
        $out = [];
        foreach ($row as $key => $value) {
            if (! isset($safe[$key])) {
                continue;
            }

            // Relasi passthrough (parentColumn): teruskan apa adanya.
            if (isset($passthrough[$key])) {
                $out[$key] = $value;

                continue;
            }

            // Relasi ter-load: batasi kolom anaknya sesuai fields "<rel>.<col>".
            if (isset($relatedModels[$key]) && \is_array($value)) {
                $relModel  = $relatedModels[$key];
                $relFields = $this->relationFields($fields, $key);
                $relWith   = $this->relationFields($withRelationPaths, $key);
                $relSafe   = $this->safeLookupColumns($relModel, $relFields, $perm, $relWith);
                $relRels   = $this->relatedModelMap($relModel);
                // Relasi plural (list of rows) vs singular (satu row).
                $isList = \array_is_list($value) && (\count($value) === 0 || \is_array($value[0] ?? null));
                if ($isList) {
                    $out[$key] = \array_map(
                        fn ($child) => \is_array($child) ? $this->filterRowColumns($child, $relSafe, $relRels, $perm, $relFields, withRelationPaths: $relWith) : $child,
                        $value,
                    );
                } else {
                    $out[$key] = $this->filterRowColumns($value, $relSafe, $relRels, $perm, $relFields, withRelationPaths: $relWith);
                }

                continue;
            }

            // Relasi morph (tak ada di relatedModels — class child berbeda per-row).
            // SELECT-level tak bisa prune morph child, jadi saring DI SINI per-row:
            // FQCN dari kolom `<key>_type` di ROW INDUK, lalu batasi ke kolom amannya.
            if (\is_array($value) && ($morphClass = $this->morphClassFromRow($key, $row)) !== null) {
                if (! \method_exists($morphClass, 'getColumns')) {
                    continue; // fail-closed: class morph asing → buang seluruh relasi.
                }
                $relFields = $this->relationFields($fields, $key);
                $relWith   = $this->relationFields($withRelationPaths, $key);
                $relSafe   = $this->safeLookupColumns($morphClass, $relFields, $perm, $relWith);
                $relRels   = $this->relatedModelMap($morphClass);
                $out[$key] = $this->filterRowColumns($value, $relSafe, $relRels, $perm, $relFields, withRelationPaths: $relWith);

                continue;
            }

            $out[$key] = $value;
        }

        return $out;
    }

    /**
     * Tentukan FQCN class child relasi morph dari ROW INDUK. Morph type tersimpan
     * di kolom `<key>_type` induk (konvensi Eloquent morphTo, mis. `document_type`).
     * Return null bila bukan morph (tak ada `<key>_type` valid) → bukan kandidat
     * penyaringan morph (relasi biasa sudah ditangani via relatedModels).
     *
     * @param  array<string,mixed>  $row  row induk (hasil toArray)
     * @return class-string|null
     */
    private function morphClassFromRow(string $key, array $row): ?string {
        $class = $row[$key . '_type'] ?? null;
        if (\is_string($class) && $class !== '' && \class_exists($class)) {
            return $class;
        }

        return null;
    }

    /**
     * Peta relasi aman → kolom aman child, untuk SELECT-level pruning relasi
     * (resolveForSafe). Hanya relasi non-morph yang ada di `$safe` (type relation)
     * di-resolve; morph dilewati (child SELECT *, tak bisa prune build-time).
     *
     * `$withRelations` di sini adalah relasi TOP-LEVEL diminta `with` (mis.
     * "items.item" → "items"). Segmen nested di baliknya ("item") diteruskan sbg
     * `$withRelations` KHUSUS child agar `safeLookupColumns` child tahu relasi
     * bertingkat itu juga diminta (relasi child baru lolos gate bila di $withSet
     * ATAU direquest lewat fields dot — tanpa ini, FK relasi nested tak ke-SELECT
     * sehingga relasi cucu gagal ter-hydrate walau ada di `with` request).
     *
     * @param  array<string,bool>  $safe  kolom aman model utama
     * @param  array<string,string>  $relModels  relasi → FQCN (relatedModelMap)
     * @param  list<string>  $fields  kolom diminta (dot-notation utk relasi)
     * @param  list<string>  $withRelationPaths  path relasi mentah dari request `with` (dot-notation, snake per segmen)
     * @return array<string,array<string,bool>>
     */
    private function safeRelationColumns(array $safe, array $relModels, array $fields, PermissionChecker $perm, array $withRelationPaths = []): array {
        $out = [];
        foreach ($relModels as $rel => $childClass) {
            if (! isset($safe[$rel]) || ! \class_exists($childClass) || ! \method_exists($childClass, 'getColumns')) {
                continue;
            }
            $childFields = $this->relationFields($fields, $rel);
            $childWith   = $this->relationFields($withRelationPaths, $rel);
            $out[$rel]   = $this->safeLookupColumns($childClass, $childFields, $perm, $childWith);
        }

        return $out;
    }

    /**
     * Peta nama-relasi (snake, sesuai key kolom getColumns) → FQCN model relasi.
     * Relasi MORPH dikecualikan: class child-nya berbeda per-row (tak bisa dari
     * metadata) sehingga ditangani per-row via morphClassFromRow di filterRowColumns.
     * Hanya morphTo yang ditandai `typeRelation: morph` (lihat
     * LinkModel::computeColumnsFlat) — morphMany/morphOne class child-nya FIXED,
     * ditandai `basic` spt relasi biasa, jadi otomatis lolos di sini.
     *
     * @return array<string,string>
     */
    private function relatedModelMap(string $model): array {
        if (isset($this->relatedModelMapCache[$model])) {
            return $this->relatedModelMapCache[$model];
        }

        $map = [];
        foreach ($model::getColumns(1) as $col) {
            if (
                \in_array($col['type'] ?? null, ['relation', 'relations'], true)
                && ($col['typeRelation'] ?? null) !== 'morph'
                && ! empty($col['name'])
                && ! empty($col['related'])
            ) {
                $map[$col['name']] = $col['related'];
            }
        }

        return $this->relatedModelMapCache[$model] = $map;
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
        $isCache  = $request->boolean('cacheMode');
        $model    = $request->model;
        $search   = $isCache ? '' : ($request->search ?? '');
        $template = $model::templateLink();
        // Ekstrak daftar atribut dari template
        preg_match_all('/:((\w[\w]+{:[\w]+})|(\w[\w.]*))/', $template, $matches);
        if (! $isCache) {
            if ($request->has('keywords')) {
                $flatAttributes = $request->keywords;
                $resolvedPaths  = [];
            } else {
                $allAttrs = array_unique(array_map(
                    fn ($attr) => preg_replace('/{:.*}/', '', ltrim($attr, ':')),
                    $matches[0],
                ));

                // Gunakan FilterColumnResolver untuk klasifikasi tiap token via getColumns —
                // ini sumber kebenaran: apakah segmen adalah relasi atau kolom/attribute.
                $resolver = new FilterColumnResolver($model::getColumns(1, true));

                $flatAttributes = [];
                // Tiap entry: ['relations' => [{function, isMorph},...], 'columnName' => 'col']
                $resolvedPaths = [];

                foreach ($allAttrs as $attr) {
                    $path = $resolver->resolvePath($attr);
                    if ($path === null) {
                        continue; // token tidak valid / tidak ditemukan di getColumns
                    }

                    $colType    = $path['column']['type'] ?? null;
                    $isRelation = \in_array($colType, ['relation', 'relations'], true);

                    if (empty($path['relations']) && ! $isRelation) {
                        // Kolom/attribute flat di tabel model saat ini
                        $flatAttributes[] = $path['columnName'];
                    } elseif ($isRelation && empty($path['relations'])) {
                        // Bare relation tanpa kolom spesifik — resolve kolom dari templateLink child
                        $relatedClass = $path['column']['related'] ?? null;
                        if ($relatedClass && \method_exists($relatedClass, 'templateLink')) {
                            $childResolver = new FilterColumnResolver($relatedClass::getColumns(1, true));
                            \preg_match_all('/:((\w[\w]+{:[\w]+})|(\w[\w.]*))/', (string) $relatedClass::templateLink(), $m);
                            $childAttrs = \array_unique(\array_map(
                                fn ($t) => \preg_replace('/{:.*}/', '', \ltrim($t, ':')),
                                $m[0],
                            ));
                            foreach ($childAttrs as $childAttr) {
                                $childPath = $childResolver->resolvePath($childAttr);
                                if ($childPath === null) {
                                    continue;
                                }
                                $childColType = $childPath['column']['type'] ?? null;
                                if (! \in_array($childColType, ['relation', 'relations'], true)) {
                                    // Tambahkan sebagai path dengan 1 relasi
                                    $resolvedPaths[] = [
                                        'relations' => [[
                                            'function' => $path['column']['nameOfFunction'] ?? $path['columnName'],
                                            'isMorph'  => ($path['column']['typeRelation'] ?? 'basic') === 'morph',
                                        ]],
                                        'column'     => $childPath['column'],
                                        'columnName' => $childPath['columnName'],
                                    ];
                                }
                            }
                        }
                    } elseif (! $isRelation) {
                        // Satu atau lebih level relasi dengan kolom akhir — whereHas bersarang
                        $resolvedPaths[] = $path;
                    }
                    // Jika isRelation && !empty(relations): segmen akhir adalah relasi tanpa kolom → skip
                    // (tidak bisa search di relasi tanpa tahu kolom tujuan)
                }
            }

            $flatAttributes = \collect($flatAttributes)->unique()->values()->toArray();

            // Closure rekursif untuk membangun nested whereHas dari chain relasi
            $buildRelationQuery = function (Builder $query, array $relations, string $columnName, string $item) use (&$buildRelationQuery) {
                $rel = array_shift($relations);
                $fn  = $rel['function'];
                $query->orWhereHas($fn, function (Builder $q) use ($relations, $columnName, $item, $buildRelationQuery) {
                    if (empty($relations)) {
                        $q->where($columnName, 'like', "%{$item}%");
                    } else {
                        $buildRelationQuery($q, $relations, $columnName, $item);
                    }
                });
            };

            // Closure untuk menambahkan semua relation search ke query
            $addRelationSearch = function (Builder $query, string $item) use ($resolvedPaths, $buildRelationQuery) {
                foreach ($resolvedPaths as $path) {
                    $buildRelationQuery($query, $path['relations'], $path['columnName'], $item);
                }
            };

            if (\method_exists($model, 'scopeLinkModel')) {
                $query = $model::linkModel($search);
            } else {
                $query = $model::where(function (Builder $query) use ($search, $flatAttributes, $addRelationSearch, $request, $isCache) {
                    $splitSearch = explode(' ', $search);
                    foreach ($splitSearch as $item) {

                        preg_match_all('/[a-zA-Z0-9]+/', $item, $matches);

                        if (count($matches[0]) == 1 && ! Utils::isNullOrWhitespace($item) && $item == $matches[0][0]) {
                            if ($flatAttributes) {
                                $query->whereAny($flatAttributes, 'like', "%{$item}%");
                            }
                            $addRelationSearch($query, $item);
                            $this->queryTranslations($query, $request, $item, 'or', ! $isCache);

                            continue;
                        }
                        if (preg_match('/^[^\w]+$/', $item)) {
                            continue;
                        }

                        $query->where(function (Builder $query) use ($matches, $item, $flatAttributes, $addRelationSearch, $request, $isCache) {
                            if (! Utils::isNullOrWhitespace($item)) {
                                if ($flatAttributes) {
                                    $query->whereAny($flatAttributes, 'like', "%{$item}%");
                                }
                                $addRelationSearch($query, $item);
                                $this->queryTranslations($query, $request, $item, 'or', ! $isCache);
                            }
                            foreach ($matches[0] as $match) {
                                if (Utils::isNullOrWhitespace($match)) {
                                    continue;
                                }
                                if ($flatAttributes) {
                                    $query->orWhereAny($flatAttributes, 'like', "%{$match}%");
                                }
                                $addRelationSearch($query, $match);
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

        // Wildcard "*": expand ke semua nama relasi top-level dari getColumns.
        if (\in_array('*', (array) $with, true)) {
            $allRelations = \array_values(\array_map(
                fn ($col) => $col['nameOfFunction'] ?? $col['name'],
                \array_filter(
                    $model::getColumns(1),
                    fn ($col) => \in_array($col['type'] ?? null, ['relation', 'relations'], true),
                ),
            ));
            $with = $allRelations;
        }

        // Nama relasi top-level yang diminta lewat `with` (numeric/assoc/dot-notation
        // dinormalisasi ke segmen pertama, mis. "branches.city" → "branches").
        // Di-snake_case agar match key getColumns: relasi method camelCase
        // (mis. defaultUom/childrenUnsafe) di-emit getColumns sbg snake (default_uom/
        // children_unsafe), sedangkan `with` request memakai nama method camelCase.
        // Dipakai gate kolom agar relasi yang diminta via `with` tak di-prune.
        //
        // $withRelationPaths mempertahankan PATH PENUH (tiap segmen di-snake, mis.
        // "items.item" → "items.item") — dibutuhkan agar relasi BERTINGKAT (Purchase-
        // OrderItem::item di dalam PurchaseOrder::items) juga lolos gate kolom child;
        // tanpa ini, FK relasi nested tak ke-SELECT & relasi cucu gagal ter-hydrate
        // walau eksplisit diminta via `with`.
        $withRelations     = [];
        $withRelationPaths = [];
        foreach ((array) $with as $k => $v) {
            $rel = \is_int($k) ? $v : $k;
            if (\is_string($rel) && $rel !== '') {
                $segments            = \array_map(fn ($s) => Str::snake($s), \explode('.', $rel));
                $withRelations[]     = $segments[0];
                $withRelationPaths[] = \implode('.', $segments);
            }
        }
        $withRelations     = \array_values(\array_unique($withRelations));
        $withRelationPaths = \array_values(\array_unique($withRelationPaths));

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

        // Kolom aman dihitung lebih dulu agar dipakai BOTH untuk SELECT-level (DB
        // hanya baca kolom aman) DAN filterRowColumns (lapis kedua, response).
        $perm     = PermissionChecker::forUser($request);
        $fields   = \is_array($request->fields ?? null) ? \array_values($request->fields) : [];
        $safe     = $this->safeLookupColumns($model, $fields, $perm, $withRelations, $isCache);
        $relModes = $this->relatedModelMap($model);

        // SELECT-level pruning: hanya bila TIDAK ada join (jalur join pakai addSelect
        // manual + SELECT *, konflik dgn select presisi). Cache mode tetap aman.
        if (! $request->has('joins')) {
            $columns      = $model::getColumns(1);
            $templateLink = \method_exists($model, 'templateLink') ? $model::templateLink() : null;
            $safeRelCols  = $this->safeRelationColumns($safe, $relModes, $fields, $perm, $withRelationPaths);
            $selector     = new DataTableColumnSelector(new FilterColumnResolver($columns));
            $resolved     = $selector->resolveForSafe($columns, new $model, $safe, $safeRelCols, $templateLink);

            $query->select($resolved['select']);
            // with map (closure child-select / null→SELECT*) digabung relasi manual.
            $withMap = $resolved['with'];
            foreach ((array) $with as $k => $v) {
                $rel = \is_int($k) ? $v : $k;
                if (\is_string($rel) && ! \array_key_exists($rel, $withMap)) {
                    $withMap[$rel] = \is_int($k) ? null : $v;
                }
            }
            // null entries → eager-load apa adanya (numeric); closure no-op merusak morphTo.
            $with = DataTableColumnSelector::withArray($withMap);
        }

        // Single-item lookup by id: direlokasi ke sini agar $safe dan $columns sudah tersedia
        // untuk applyAppends. find() langsung via model (tanpa search constraints $query).
        // withTrashed bila model ber-SoftDeletes: nilai relasi tersimpan (mis. Ticket/Todo show)
        // harus tetap resolve walau record-nya sudah di-soft-delete.
        if ($request->has('id')) {
            $usesSoftDeletes = \in_array(SoftDeletes::class, class_uses_recursive($model));
            $dataModel       = $usesSoftDeletes ? $model::withTrashed()->find($request->id) : $model::find($request->id);
            if ($dataModel !== null) {
                if ($request->has('with')) {
                    $dataModel->load($request->with);
                }
                if (! $request->has('joins') && isset($columns)) {
                    DataTableColumnSelector::applyAppends($dataModel, $columns, $safe);
                }
            }

            return response()->json($dataModel);
        }

        $query->with($with);
        if ($request->has('order')) {
            $orders = explode(':', $request->order);
            $query->orderBy($orders[0], $orders[1] ?? 'asc');
        }
        $collection = $query->get();
        if (! $request->has('joins') && isset($columns)) {
            DataTableColumnSelector::applyAppends($collection, $columns, $safe);
        }
        $data = $collection->toArray() ?? [];

        // Lapis kedua (defense-in-depth): saring tiap row ke kolom aman, termasuk
        // relasi morph child yang tak bisa di-prune di SELECT.
        $results = array_map(
            fn ($value) => $this->filterRowColumns($value, $safe, $relModes, $perm, $fields, withRelationPaths: $withRelationPaths),
            $data,
        );

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

        // Batasi kolom tiap row paginate ke kolom aman (templateLink + columns∩linkable
        // − visibleFor gagal). `columns` (showedColumns) berperan sbg kolom diminta;
        // parentColumn (relasi balik per-item) selalu diizinkan agar tetap tampil.
        $perm      = PermissionChecker::forUser($request);
        $requested = $parentColumn ? [...$showedColumns, $parentColumn] : $showedColumns;
        $safe      = $this->safeLookupColumns($target, $requested, $perm);
        $relModels = $this->relatedModelMap($target);
        if ($parentColumn && isset($parentRel, $parent)) {
            $safe[$parentColumn]      = true;
            $relModels[$parentColumn] = $parent;
        }
        $passthrough = $parentColumn ? [$parentColumn => true] : [];
        $reqFields   = \array_values($requested);
        $paginated   = $result['data'];
        if (\is_object($paginated) && \method_exists($paginated, 'through')) {
            $paginated->through(fn ($row) => $this->filterRowColumns(
                \is_array($row) ? $row : $row->toArray(),
                $safe,
                $relModels,
                $perm,
                $reqFields,
                $passthrough,
            ));
        }

        return response()->json([
            'model'        => $target,
            'route'        => Str::plural((new $target)->getNameClass()),
            'translateKey' => (new $target)->translateKey ?? null,
            'columns'      => $columns,
            'parentColumn' => $parentColumn,
            'data'         => $paginated,
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
