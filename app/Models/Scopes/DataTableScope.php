<?php

namespace App\Models\Scopes;

use App\Models\Core\Branch;
use App\Models\Core\Preference;
use App\Models\Core\SavedFilter;
use App\Services\Core\DataTable\Group\GroupColumnGate;
use App\Services\Core\DataTable\Group\GroupLevelResolver;
use App\Services\Core\DataTable\Group\GroupLevels;
use App\Services\Core\DataTable\Group\GroupNodeQuery;
use App\Services\Core\DataTable\Group\GroupPath;
use App\Services\Core\DataTable\Group\ResolvedGroupLevel;
use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
use App\Services\Core\FilterEvaluator;
use App\Utils;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;

class DataTableScope implements Scope {
    /**
     * Cache in-memory (statis, per proses PHP) status is_main_branch per id --
     * applyBranchFilter() dipanggil ulang tiap macro dataTable() jalan (index
     * utama + tiap LinkModel dropdown ber-HasBranch di halaman yang sama),
     * padahal session('currentBranch') tidak berubah dalam satu request/proses.
     * Direset di Tests\TestCase::setUp() (lihat SchemaColumnCache utk pola sama).
     *
     * @var array<string, Branch|null>
     */
    private static array $branchMainStatusCache = [];

    public static function forgetBranchMainStatusCache(): void {
        self::$branchMainStatusCache = [];
    }

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
     * Sanitasi `searchScope` model (App\Traits\DataTable::getSearchScope())
     * sebelum di-share ke FE -- entri yang tidak ter-resolve
     * (FilterColumnResolver, dukung dot-notation relasi), `searchable === false`,
     * atau tipe akhir BUKAN 'string' dibuang diam-diam (Requirement 5.2, 5.3).
     * Resolver yang SAMA dipakai FilterTreeCleaner/FilterEvaluator -- satu
     * sumber kebenaran resolusi kolom.
     *
     * @param  list<string>  $searchScope
     * @param  array<string,mixed>|list<array<string,mixed>>  $dataTableColumns
     * @return list<string>
     */
    private function sanitizeSearchScope(array $searchScope, array $dataTableColumns): array {
        $resolver = new FilterColumnResolver($dataTableColumns);

        return \array_values(\array_filter($searchScope, function ($key) use ($resolver) {
            if (! \is_string($key) || $key === '') {
                return false;
            }
            $column = $resolver->resolve($key);
            if ($column === null || ($column['searchable'] ?? true) === false) {
                return false;
            }

            return ($column['type'] ?? null) === 'string';
        }));
    }

    /**
     * True bila method relasi (segmen pertama, sebelum "." pada relasi nested)
     * sudah memanggil withTrashed() sendiri di source-nya — macro withTrashed()
     * global TIDAK boleh ikut campur di relasi ini (lihat catatan di addDataTable()).
     */
    private function relationDefinesOwnWithTrashed(string $modelClass, string $relationKey): bool {
        $method = \strtok($relationKey, '.');
        if (! \method_exists($modelClass, $method)) {
            return false;
        }

        try {
            $reflection = new \ReflectionMethod($modelClass, $method);
            $file       = $reflection->getFileName();
            if ($file === false) {
                return false;
            }
            $lines = \array_slice(\file($file), $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1);

            return \str_contains(\implode('', $lines), 'withTrashed');
        } catch (\ReflectionException) {
            return false;
        }
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

    /**
     * Filter listing berdasar branch aktif untuk model yang pakai trait HasBranch.
     * Branch utama (session `currentBranch`) melihat semua baris; branch lain
     * hanya melihat baris miliknya. Terpisah dari HasBranch::bootHasBranch()
     * (aturan non-listing berbasis afiliasi user) karena macro ini dipakai baik
     * oleh index resource maupun endpoint generic ModelController::datatable()/
     * selectData() — keduanya sama-sama listing meski nama route-nya berbeda.
     */
    private function applyBranchFilter(Builder $query): void {
        $model = $query->getModel();
        if (! \method_exists($model, 'getBranchColumn')) {
            return;
        }

        // Lepas aturan non-listing HasBranch (afiliasi user) — listing punya
        // aturannya sendiri di bawah (currentBranch session), supaya tak
        // tumpang tindih/konflik dengan filter afiliasi user.
        $query->withoutGlobalScope('branch');

        if (! session()->has('currentBranch')) {
            return;
        }

        // select+withoutGlobalScope('country'): applyBranchFilter cuma butuh
        // id/is_main_branch, tapi Branch::find() biasa memicu 2 query Country
        // tambahan (billingCountry+shippingCountry via $with Branch) setiap
        // kali macro dataTable() jalan — N+1 nyata karena dipanggil berulang
        // per halaman (index utama + tiap LinkModel dropdown ber-HasBranch).
        // Di-cache per id (statis, per proses) -- currentBranch tak berubah
        // dalam satu request, jadi lookup ini juga tak perlu diulang.
        $branchId = session('currentBranch');
        if (! \array_key_exists($branchId, self::$branchMainStatusCache)) {
            self::$branchMainStatusCache[$branchId] = Branch::query()
                ->withoutGlobalScope('country')
                ->select(['id', 'is_main_branch'])
                ->find($branchId);
        }
        $branch = self::$branchMainStatusCache[$branchId];
        if (! $branch || $branch->is_main_branch) {
            return;
        }

        $query->where($model->getTable() . '.' . $model::getBranchColumn(), $branch->id);
    }

    protected function addDataTable(Builder $builder) {
        $builder->macro('dataTable', function (Builder $query, Request $request, ?array $showedColumns = null) {
            $this->applyBranchFilter($query);

            $dataTableColumns = \get_class($query->getModel())::getColumns(1);
            $dataTableColumns = GroupColumnGate::sanitizeColumns($dataTableColumns, $query->getModel());
            // Dipindah ke awal (sebelumnya di dekat blok `show`) -- dibutuhkan
            // blok validasi `?group=` tepat di bawah, utk kualifikasi kolom.
            $nameOfTable = $query->toBase()->from;

            // Default shared filter (Filter Templates): resolusi PALING AWAL --
            // dibutuhkan blok validasi `?group=` DAN sort di bawah (grup/sort
            // BAWAAN filter default ikut jadi fallback halaman). `fid` eksplisit
            // SELALU menang — default hanya dipakai saat request benar-benar
            // tanpa fid.
            $modelClassForFilter = \get_class($query->getModel());
            $appliedFilter       = null;
            if ($request->filled('fid')) {
                $candidate = SavedFilter::find($request->input('fid'));
                if ($candidate && $candidate->model === $modelClassForFilter) {
                    $appliedFilter = $candidate;
                }
            } else {
                $appliedFilter = SavedFilter::defaultFor($modelClassForFilter)->first();
            }
            // Group EFEKTIF request ini (GroupLevelResolver): prioritas `?group=`
            // (ada; KOSONG = "Tidak ada") > group milik filter aktif > default
            // model, gate `groupable` per level, maks GroupLevels::MAX_LEVELS.
            // Group filter aktif & default model HANYA utk request halaman/
            // Inertia: grouping memaksa kolom grup jadi sort PRIMER + query GROUP
            // BY tambahan, padahal konsumen XHR macro ini (mis. QuickListBlock
            // dashboard dgn ?fid=, dropdown LinkModel) tidak merender header grup
            // -- urutan barisnya jangan berubah diam-diam. `?group=` eksplisit
            // tetap berlaku di XHR. Divalidasi di sini (awal, sebelum select-
            // pruning) supaya nama AKSESOR kolom grup (bukan kolom SQL FK hasil
            // resolve) bisa dipaksa masuk extraKeys di bawah: tanpa itu kolom
            // relasi yg groupable tapi disembunyikan user (cookie visible
            // columns) tak ikut ter-eager-load -- row[groupBy] di FE undefined.
            $isInertia     = Utils::isInertiaRequest($request);
            $appliedGroups = $isInertia ? GroupLevels::normalize($appliedFilter?->group) : [];
            $modelDefaults = $isInertia ? $query->getModel()::getDefaultGroups() : [];
            $groupLevels   = GroupLevelResolver::resolve(
                $request,
                $appliedGroups,
                $modelDefaults,
                $dataTableColumns,
                $query->getModel(),
                $nameOfTable,
            );
            // Grup EFEKTIF TANPA PARAM (filter aktif ?? default model), gate
            // groupable sendiri -- BISA beda dari $groupLevels kalau request
            // mengirim `?group=`/`?groupGranularity=`/`?groupRange=` eksplisit.
            // Di-share ke FE sbg `defaultGroups` supaya state awal `options`
            // cocok dgn yg dieksekusi backend saat halaman dimuat tanpa param
            // apa pun.
            $defaultGroups = \array_map(
                fn (ResolvedGroupLevel $level) => $level->toGroup(),
                GroupLevelResolver::resolveDefaults(
                    $appliedGroups,
                    $modelDefaults,
                    $dataTableColumns,
                    $query->getModel(),
                    $nameOfTable,
                ),
            );
            // Engine pohon grup aktif untuk request halaman (level-0) ATAU
            // request expand (`groupPath`) -- deteksi expand berdasarkan
            // kehadiran param, BUKAN ajax()/header Inertia. XHR lain (LinkModel,
            // dashboard) tanpa `groupPath` mengabaikan `group` (tetap flat).
            $isExpand    = $request->has('groupPath');
            $isGroupTree = $groupLevels !== [] && ($isInertia || $isExpand);
            if ($isExpand && $groupLevels === []) {
                throw new HttpResponseException(response()->json([
                    'message' => 'Tidak ada level grup yang valid untuk groupPath ini.',
                ], 422));
            }
            // Kolom visible dari cookie (standar Laravel; plaintext krn dikecualikan
            // dari enkripsi di bootstrap/app.php). Nama cookie unik per-path (suffix
            // path ter-sanitize) agar tak bentrok antar-halaman di sebagian browser.
            // Hanya himpunan nama kolom yang dipakai — width & order diabaikan (frontend).
            $cookieRaw   = $request->cookie($this->datatableColumnsCookieKey($request->path()));
            $visibleKeys = \is_string($cookieRaw)
                ? \array_keys(\json_decode($cookieRaw, true) ?: [])
                : null;

            $isSubmitable = $query->getModel()->isSubmitable();
            // Prioritas: query param `show` > cookie `datatable_show` > default preference.
            // Query Preference LAZY (inline di rantai ??, bukan diresolusi duluan) --
            // cookie datatable_show persist 7 hari, jadi setelah kunjungan pertama
            // fallback preference ini nyaris tak pernah kepakai; eager sebelumnya
            // berarti 1 query DB percuma di HAMPIR SETIAP request dataTable().
            $showFromQuery = $request->input('show');
            $show          = (int) (
                $showFromQuery
                ?? $request->cookie('datatable_show')
                ?? (Preference::where('key', 'num_per_page')->first()?->value ?? 25)
            );
            $show = $show <= 0 ? 25 : $show;
            // Kalau `show` datang dari query param, persist ke cookie pada path yang
            // diakses agar konsisten di kunjungan berikutnya tanpa query param.
            if ($showFromQuery !== null) {
                Cookie::queue(
                    Cookie::make('datatable_show', (string) $show, 60 * 24 * 7, '/' . ltrim($request->path(), '/')),
                );
            }

            // Sort — konvensi: prefix `-` = descending, tanpa prefix = ascending.
            // Parse via str_starts_with agar key ber-dash / nested tetap utuh.
            // Prioritas: ?sort= eksplisit > sort bawaan filter default (Filter
            // Templates) > default kolom sort per-model (Model::$defaultSortColumn,
            // fallback 'created_at' kalau model tidak override).
            // GATE sortable — sebelumnya $sort request masuk orderBy() tanpa
            // validasi sama sekali. Cuma validasi sumber USER-FACING (?sort=
            // eksplisit atau sort bawaan saved filter) -- default kolom sort
            // model (fallback) dipercaya begitu saja (developer-controlled,
            // bukan input luar). Kolom tak dikenal/sortable:false/dotted path
            // relasi -> diam-diam pakai fallback, bukan error.
            $requestedSort = $request->input('sort') ?? $appliedFilter?->sort;
            $fallbackSort  = '-' . $query->getModel()::getDefaultSortColumn();

            $sort = $fallbackSort;
            if ($requestedSort) {
                $reqDirection = \str_starts_with($requestedSort, '-') ? 'desc' : 'asc';
                $reqKeyRaw    = $reqDirection === 'desc' ? \substr($requestedSort, 1) : $requestedSort;

                $sortConfig = collect($dataTableColumns)->firstWhere('name', $reqKeyRaw);
                $isSortable = $sortConfig && ($sortConfig['sortable'] ?? true) !== false;

                if ($isSortable) {
                    $sort = $requestedSort;
                }
            }
            // Sort user = SATU-SATUNYA ORDER BY baris. Saat grouping aktif, baris
            // hanya di-query per node daun (semua baris di node itu sudah satu
            // grup penuh), jadi tak ada lagi sort primer by kolom grup; daftar
            // grup diurut `key ASC` oleh GroupNodeQuery sendiri.
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
                // Aksesor kolom grup bertipe RELASI (mis. "customer") -- WAJIB
                // selalu di-select/di-with(), terlepas dari kolom visible user
                // (cookie): label grup relasi diambil dari baris sampel
                // (GroupNodeQuery) yang butuh object relasi utuh + FK-nya ikut
                // SELECT. Nama AKSESOR, bukan kolom FK SQL yg dipakai GROUP BY.
                // Kolom grup scalar tak butuh apa-apa: nilainya datang dari
                // GROUP BY, bukan dari atribut baris.
                $isGroupTree
                    ? \array_map(
                        fn (ResolvedGroupLevel $level) => $level->column,
                        \array_filter($groupLevels, fn (ResolvedGroupLevel $level) => $level->isRelation()),
                    )
                    : [],
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
            // withTrashed: relasi ber-SoftDeletes tetap dimuat walau record-nya sudah
            // dihapus, agar List/DataTable tidak kehilangan nama relasi historis (mis.
            // item/akun/customer yang di-soft-delete tapi masih dirujuk transaksi lama).
            // Dilewati untuk relasi yang method-nya sendiri sudah memanggil withTrashed()
            // (mis. PurchaseRequestItem::item() withTrashed($this->status != 'draft')) —
            // withTrashed() tanpa syarat akan SELALU menimpa hasil constraint kondisional
            // itu (withoutGlobalScope tidak bisa "dibatalkan" oleh pemanggilan kedua),
            // jadi macro ini tidak boleh ikut campur di relasi yang sudah override sendiri.
            $modelClassForWith = $modelClass;
            $scopeSelf         = $this;
            $with              = \collect($with)->mapWithKeys(function ($constraint, $key) use ($modelClassForWith, $scopeSelf) {
                if ($scopeSelf->relationDefinesOwnWithTrashed($modelClassForWith, $key)) {
                    return [$key => $constraint];
                }

                return [$key => function ($relationQuery) use ($constraint) {
                    if ($constraint instanceof \Closure) {
                        $constraint($relationQuery);
                    }
                    $relatedModel = $relationQuery instanceof Relation
                        ? $relationQuery->getRelated()
                        : $relationQuery->getModel();
                    if (\in_array(SoftDeletes::class, class_uses_recursive($relatedModel))) {
                        $relationQuery->withTrashed();
                    }
                }];
            })->all();

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
            // Filter — saved filter (nested tree) via ?fid=<id>, ATAU default
            // shared filter (Filter Templates) saat request tanpa fid sama sekali
            // ($appliedFilter sudah diresolusi di atas, sebelum parsing sort).
            // Akses by-id terbuka (tanpa cek owner); cocokkan model halaman.
            if ($appliedFilter) {
                (new FilterEvaluator($dataTableColumns))
                    ->apply($query, $appliedFilter->filter ?? []);
                // Expand kolom relasi yang dipakai filter agar frontend dapat
                // me-resolve value tanpa fetch async (hilangkan kedip/lag).
                $dataTableColumns = (new FilterColumnResolver($dataTableColumns))
                    ->expandColumnsForTree($appliedFilter->filter ?? []);
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
            // Pohon grup (spec datatable2-group-tree, Requirement 4-8): level-0 =
            // daftar nilai grup + count (+ agregat) TANPA memuat baris; isi tiap
            // grup baru di-query saat FE membukanya (request expand `groupPath`).
            // Dieksekusi di titik yang SAMA dgn jalur flat -- SETELAH semua
            // constraint macro ter-apply -- jadi memakai constraint yang IDENTIK
            // (filter, saved filter, searchScope, branch scope, submitable, scope
            // kustom controller). Tanpa level grup: jalur flat, tak berubah.
            $groupMeta = null;
            if ($isGroupTree) {
                // Kolom agregat baris grup (config `groupAggregate`, hanya lewat
                // kode) -- dihitung di SETIAP level oleh GroupNodeQuery.
                $aggregates = GroupColumnGate::aggregates($dataTableColumns);
                $sampleBase = clone $query;
                $node       = new GroupNodeQuery(
                    $query,
                    $groupLevels,
                    $show,
                    aggregates: $aggregates,
                    // Sort tabel ke kolom agregat -> baris grup ikut urut menurut
                    // agregat itu; `groupSort` = arah urutan menurut nilai grup
                    // (chip group), TERPISAH dari `sort` tabel/URL.
                    sortAggregate: \collect($aggregates)->contains('column', $sortKeyRaw) ? $sortKeyRaw : null,
                    sortDirection: $sortDirection,
                    keyDirection: $request->input('groupSort') === 'desc' ? 'desc' : 'asc',
                    loadSamples: function (array $ids) use ($sampleBase, $nameOfTable, $dataTableColumns, $safeColumns) {
                        $sampleQuery = clone $sampleBase;
                        $models      = $sampleQuery
                            ->whereIn($nameOfTable . '.' . $sampleQuery->getModel()->getKeyName(), $ids)
                            ->get();
                        DataTableColumnSelector::applyAppends($models, $dataTableColumns, $safeColumns);

                        return $models->keyBy(fn (Model $model) => $model->getKey());
                    },
                );
                $path   = GroupPath::parse($request->input('groupPath'), $groupLevels);
                $page   = \max(1, (int) $request->input($isExpand ? 'groupPage' : 'page', 1));
                $isLeaf = \count($path) === \count($groupLevels);

                $paginator = $isLeaf ? $node->rows($path, $page) : $node->groups($path, $page);
                if ($isLeaf) {
                    DataTableColumnSelector::applyAppends($paginator, $dataTableColumns, $safeColumns);
                }
                if ($isExpand) {
                    throw new HttpResponseException(response()->json([
                        'type' => $isLeaf ? 'rows' : 'groups',
                        ...$paginator->toArray(),
                    ]));
                }
                $groupMeta = [
                    // Nilai EFEKTIF yang dipakai SQL -- satu-satunya sumber utk
                    // dekode label grup di FE (granularity/range sudah berdefault).
                    'levels' => \array_map(
                        fn (ResolvedGroupLevel $level) => [...$level->toGroup(), 'type' => $level->type],
                        $groupLevels,
                    ),
                    'aggregates' => \array_map(
                        fn (array $aggregate) => ['column' => $aggregate['column'], 'fn' => $aggregate['fn']],
                        $aggregates,
                    ),
                ];
            } else {
                $paginator = $query->paginate($show);
                DataTableColumnSelector::applyAppends($paginator, $dataTableColumns, $safeColumns);
            }
            $data = [
                'data' => $paginator,
            ];
            if (! $isInertia) {
                return $data;
            }
            Inertia::share([
                ...$data,
                'defaultSort' => '-created_at',
                // fid yang otomatis diterapkan tanpa ?fid= eksplisit (shared filter
                // default dari Filter Templates) — null bila request punya fid
                // sendiri atau tidak ada default utk model ini.
                'defaultFilterId'  => ! $request->filled('fid') ? $appliedFilter?->id : null,
                'name'             => $query->getModel()->getNameClass(),
                'translateKey'     => $query->getModel()->translateKey ?? null,
                'dataTableColumns' => $dataTableColumns,
                // null bila grouping tak aktif (tanpa level valid) -- FE merender tabel flat.
                'groupMeta' => $groupMeta,
                // Grup EFEKTIF TANPA PARAM (filter aktif ?? default model, sudah
                // divalidasi groupable) -- FE pakai utk state awal Group by (agar
                // cocok dgn yg dieksekusi backend saat halaman dimuat tanpa param)
                // & tahu harus kirim `group=` KOSONG (bukan hilangkan param) saat
                // user memilih "Tidak ada". Nilai granularity/range EFEKTIF.
                'defaultGroups' => $defaultGroups,
                // Kolom pencarian teks bebas (Search Bar) -- sudah tersanitasi
                // (App\Traits\DataTable::getSearchScope(), Requirement 5.2-5.3).
                'searchScope' => $this->sanitizeSearchScope($query->getModel()::getSearchScope(), $dataTableColumns),
            ]);
        });
    }
}
