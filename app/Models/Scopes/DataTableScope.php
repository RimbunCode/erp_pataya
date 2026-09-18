<?php

namespace App\Models\Scopes;

use App\Models\Core\Branch;
use App\Models\Core\Preference;
use App\Models\Core\SavedFilter;
use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
use App\Services\Core\FilterEvaluator;
use App\Utils;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
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
     * Kolom SQL riil (GROUP BY / ORDER BY) utk kolom `type: relation`. Cuma
     * didukung utk BelongsTo -- FK-nya 1 kolom scalar di tabel model INI
     * sendiri, selalu merujuk 1 related class. HasOne/MorphOne (FK ada di
     * tabel LAIN, butuh JOIN) & MorphTo (butuh kombinasi id+type, grouping
     * lintas-tipe ambigu) sengaja TIDAK didukung -- null berarti "tidak bisa
     * di-resolve ke 1 kolom", caller anggap kolom itu not-groupable.
     */
    private function resolveRelationGroupColumn(Model $model, array $columnConfig): ?string {
        $method = $columnConfig['nameOfFunction'] ?? null;
        if (! $method || ! \method_exists($model, $method)) {
            return null;
        }

        $relation = $model->$method();

        return $relation instanceof BelongsTo ? $relation->getForeignKeyName() : null;
    }

    /**
     * Kolom yg TIDAK BOLEH jadi opsi "Group by" sama sekali, walau developer
     * keliru set `groupable: true` di config model -- flag-nya dipaksa false
     * di sini SEBELUM dataTableColumns dipakai (dropdown FE & validasi
     * grouping baca dari sumber yg SAMA, satu sumber kebenaran). Alasan beda
     * per grup:
     * - `json`/`mixed`/`relations` (jamak): Cell.jsx (FE) render KOSONG utk
     *   type ini -- grouping tak ada gunanya, label grup pun tak bisa dirender.
     * - `html`: SECARA TEKNIS bisa dirender (Cell.jsx dangerouslySetInnerHTML),
     *   tapi grouping by markup mentah nyaris tak pernah berguna (value-nya
     *   nyaris selalu unik per baris), DAN contoh nyata satu2nya kolom html
     *   di codebase ini (`Log.activity_text`) adalah PHP ACCESSOR terhitung
     *   (dependsOn), BUKAN kolom DB asli -- `GROUP BY`/`ORDER BY` ke situ akan
     *   error SQL ("no such column"), bukan cuma sekadar tak berguna.
     * - relasi yg tak bisa di-resolve ke 1 kolom FK (HasOne/MorphOne/MorphTo,
     *   lihat resolveRelationGroupColumn()).
     */
    private function sanitizeGroupableColumns(array $dataTableColumns, Model $model): array {
        $excludedTypes = ['relations', 'json', 'mixed', 'html'];

        return \array_map(function ($column) use ($excludedTypes, $model) {
            if (! ($column['groupable'] ?? false)) {
                return $column;
            }

            $type = $column['type'] ?? null;
            if (\in_array($type, $excludedTypes, true)) {
                $column['groupable'] = false;
            } elseif ($type === 'relation' && $this->resolveRelationGroupColumn($model, $column) === null) {
                $column['groupable'] = false;
            }

            return $column;
        }, $dataTableColumns);
    }

    /**
     * Ekspresi SQL raw (tanpa alias) utk bucket kolom date/time/datetime per
     * granularity -- portable di 2 driver yg dipakai project ini (sqlite:
     * test+lokal, mysql: produksi, lihat .env.example). Key hasil SEMUA
     * granularity sengaja string yg urut leksikografis = urut kronologis
     * (YYYY, YYYY-MM, YYYY-Qn, YYYY-Hn, YYYY-MM-DD) -- ORDER BY ekspresi ini
     * langsung ASC tanpa perlu CAST tambahan.
     */
    private function dateGroupExpression(string $column, string $granularity): string {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return match ($granularity) {
                'day'     => "date($column)",
                'quarter' => "strftime('%Y', $column) || '-Q' || ((cast(strftime('%m', $column) as integer) + 2) / 3)",
                'half'    => "strftime('%Y', $column) || '-H' || ((cast(strftime('%m', $column) as integer) + 5) / 6)",
                'year'    => "strftime('%Y', $column)",
                default   => "strftime('%Y-%m', $column)", // month
            };
        }

        // MySQL/MariaDB (produksi, lihat .env.example).
        return match ($granularity) {
            'day'     => "date($column)",
            'quarter' => "concat(year($column), '-Q', quarter($column))",
            'half'    => "concat(year($column), '-H', ceil(month($column) / 6))",
            'year'    => "date_format($column, '%Y')",
            default   => "date_format($column, '%Y-%m')", // month
        };
    }

    /**
     * Ekspresi SQL raw + bindings utk floor(kolom / range) * range -- lower
     * bound tiap bucket number/currency. `?` di ekspresi diisi $rangeSize yg
     * SAMA berkali-kali (jumlah beda per driver, lihat di bawah), TIDAK
     * pernah diinterpolasi mentah.
     *
     * MySQL: FLOOR() native, portable. SQLite: FLOOR() TIDAK SELALU tersedia
     * (build PHP/PDO SQLite di environment ini butuh flag kompilasi
     * SQLITE_ENABLE_MATH_FUNCTIONS yg tak aktif -- ketauan dari error nyata
     * "no such function: floor" saat test) -- emulasi floor(a/b) portable
     * pakai CAST+koreksi tanda: truncation (CAST AS INTEGER) membulat ke
     * arah 0, utk nilai negatif dgn sisa non-bulat hasil truncation LEBIH
     * BESAR dari floor sebenarnya (mis. floor(-0.5)=-1, trunc(-0.5)=0) --
     * dikoreksi -1 via CASE WHEN saat quotient asli < hasil truncation-nya.
     *
     * @return array{0: string, 1: array}
     */
    private function numberGroupBucketExpression(string $column, float $rangeSize): array {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return [
                "(cast($column / ? as integer) - (case when $column / ? < cast($column / ? as integer) then 1 else 0 end)) * ?",
                [$rangeSize, $rangeSize, $rangeSize, $rangeSize],
            ];
        }

        return ["floor($column / ?) * ?", [$rangeSize, $rangeSize]];
    }

    /**
     * Validasi & resolusi ekspresi SQL bucket utk kolom groupable date/time/
     * datetime (granularity, request `?groupGranularity=`) atau number/
     * currency (lebar range, request `?groupRange=`). Kolom scalar/relation
     * biasa TIDAK butuh bucket (return null -- caller pakai plain column).
     *
     * @return array{0: string, 1: array}|null [ekspresi SQL raw, bindings]
     */
    private function resolveGroupBucketExpression(array $groupConfig, string $columnQualified, Request $request): ?array {
        $type = $groupConfig['type'] ?? null;
        if (\in_array($type, ['date', 'time', 'datetime'], true)) {
            $allowed     = ['day', 'month', 'quarter', 'half', 'year'];
            $granularity = $request->input('groupGranularity');
            $granularity = \in_array($granularity, $allowed, true) ? $granularity : 'month';

            return [$this->dateGroupExpression($columnQualified, $granularity), []];
        }
        if (\in_array($type, ['number', 'currency'], true)) {
            // rangeSize dari request TIDAK PERNAH diinterpolasi mentah ke SQL --
            // selalu lewat binding (?) meski sudah divalidasi numeric > 0 di sini,
            // konsisten dgn prinsip "jangan percaya input user di raw SQL".
            $rangeSize = $request->input('groupRange');
            $rangeSize = \is_numeric($rangeSize) && (float) $rangeSize > 0 ? (float) $rangeSize : null;
            $rangeSize ??= (float) ($groupConfig['groupRangeOptions'][0] ?? 100);

            return $this->numberGroupBucketExpression($columnQualified, $rangeSize);
        }

        return null;
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
        $branch = Branch::query()
            ->withoutGlobalScope('country')
            ->select(['id', 'is_main_branch'])
            ->find(session('currentBranch'));
        if (! $branch || $branch->is_main_branch) {
            return;
        }

        $query->where($model->getTable() . '.' . $model::getBranchColumn(), $branch->id);
    }

    protected function addDataTable(Builder $builder) {
        $builder->macro('dataTable', function (Builder $query, Request $request, ?array $showedColumns = null) {
            $this->applyBranchFilter($query);

            $dataTableColumns = \get_class($query->getModel())::getColumns(1);
            $dataTableColumns = $this->sanitizeGroupableColumns($dataTableColumns, $query->getModel());
            // Dipindah ke awal (sebelumnya di dekat blok `show`) -- dibutuhkan
            // blok validasi `?group=` tepat di bawah, utk kualifikasi kolom.
            $nameOfTable = $query->toBase()->from;

            // Validasi `?group=` di sini (awal, sebelum select-pruning) --
            // bukan cuma di blok GROUP BY count query di bawah -- supaya nama
            // AKSESOR kolom grup (bukan kolom SQL FK hasil resolve) bisa
            // dipaksa masuk extraKeys (lihat di bawah). Tanpa ini, kolom
            // relasi yg groupable tapi kebetulan disembunyikan user (cookie
            // visible columns) tidak ikut ter-eager-load walau sort sudah
            // dikunci ke FK-nya -- row[groupBy] di FE jadi undefined.
            $groupColumn    = $request->input('group');
            $groupConfig    = $groupColumn ? collect($dataTableColumns)->firstWhere('name', $groupColumn) : null;
            $isGroupable    = $groupConfig && ($groupConfig['groupable'] ?? false);
            $groupSqlColumn = $isGroupable && ($groupConfig['type'] ?? null) === 'relation'
                ? $this->resolveRelationGroupColumn($query->getModel(), $groupConfig)
                : $groupColumn;
            $isGroupable = $isGroupable && $groupSqlColumn !== null;
            // Bucket (granularity date / range number) -- null berarti kolom
            // grup biasa (plain column), non-null berarti [ekspresi SQL raw,
            // bindings] dipakai gantinya di select/groupBy/orderBy manapun
            // kolom grup ini seharusnya dipakai (lihat penggunaan di bawah).
            $groupBucket = $isGroupable
                ? $this->resolveGroupBucketExpression(
                    $groupConfig,
                    $this->isTableIncluded($groupSqlColumn) ? $groupSqlColumn : "$nameOfTable.$groupSqlColumn",
                    $request,
                )
                : null;
            // Kolom visible dari cookie (standar Laravel; plaintext krn dikecualikan
            // dari enkripsi di bootstrap/app.php). Nama cookie unik per-path (suffix
            // path ter-sanitize) agar tak bentrok antar-halaman di sebagian browser.
            // Hanya himpunan nama kolom yang dipakai — width & order diabaikan (frontend).
            $cookieRaw   = $request->cookie($this->datatableColumnsCookieKey($request->path()));
            $visibleKeys = \is_string($cookieRaw)
                ? \array_keys(\json_decode($cookieRaw, true) ?: [])
                : null;

            $isSubmitable = $query->getModel()->isSubmitable();
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
            // Default shared filter (Filter Templates): resolusi lebih dulu (sebelum
            // sort di-parse) agar sort BAWAAN filter default bisa ikut jadi default
            // sort halaman. `fid` eksplisit SELALU menang — default hanya dipakai
            // saat request benar-benar tanpa fid.
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
            // Grouping aktif: kolom grup SELALU jadi sort PRIMER (SQL mendukung
            // multi-kolom ORDER BY) -- pilihan sort user/default di bawah jadi
            // sort SEKUNDER (tie-breaker DALAM tiap grup), bukan lagi "dikunci"
            // ke kolom grup seperti sebelumnya. Baris se-grup tetap nempel
            // bersebelahan di hasil paginate krn ini dipanggil DULUAN -- Eloquent
            // orderBy() menambah klausa ORDER BY sesuai urutan pemanggilan.
            if ($isGroupable) {
                $query = $groupBucket
                    ? $query->orderByRaw("{$groupBucket[0]} asc", $groupBucket[1])
                    : $query->orderBy(
                        $this->isTableIncluded($groupSqlColumn) ? $groupSqlColumn : "$nameOfTable.$groupSqlColumn",
                        'asc',
                    );
            }
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
                // Aksesor kolom grup AKTIF (mis. "account_type"/"customer") --
                // WAJIB selalu di-select/di-with(), terlepas dari kolom visible
                // user (cookie) & terlepas dari sort user (sort sekunder TIDAK
                // lagi dikunci ke kolom grup, jadi tidak bisa lagi "menumpang"
                // inklusi via $sortKeyRaw spt sebelumnya). Utk relasi ini nama
                // AKSESOR (bukan kolom FK SQL yg dipakai GROUP BY/ORDER BY) --
                // row butuh object relasi utuh, bukan cuma id-nya.
                $isGroupable ? [$groupColumn] : [],
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
            // Grouping (opt-in) — hitung count per grup lewat query TERPISAH, pakai
            // WHERE/filter/branch-scope yang SAMA (clone $query di titik ini, setelah
            // semua constraint di atas ter-apply). $isGroupable/$groupSqlColumn/
            // $groupBucket sudah divalidasi di awal macro (lihat komentar di sana)
            // -- dipakai ulang di sini, bukan re-derive, satu sumber kebenaran.
            $groupCounts = null;
            if ($isGroupable) {
                $groupCol = $this->isTableIncluded($groupSqlColumn) ? $groupSqlColumn : "$nameOfTable.$groupSqlColumn";

                $countQuery                      = clone $query;
                $countQuery->getQuery()->orders  = [];
                $countQuery->getQuery()->columns = null; // reset select -- selectRaw APPEND, bukan REPLACE spt select().
                // `->orders = []` cuma bersihkan teks klausa ORDER BY, BUKAN
                // bindings-nya (2 array terpisah di QueryBuilder) -- kalau
                // sort primer grup barusan pakai orderByRaw() (bucket date/
                // number, ada placeholder `?`), bindings 'order' yg nyangkut
                // di clone ini bikin jumlah binding > jumlah `?` di SQL akhir
                // (order clause sudah dibuang) -> PDO "column index out of range".
                $countQuery->getQuery()->bindings['order'] = [];
                $countQuery->setEagerLoads([]);

                // Alias tetap "group_key" baik plain column maupun bucket
                // (granularity date / range number) -- satu bentuk pembacaan
                // hasil query, tak perlu tau lagi nama kolom asli/short-nya.
                if ($groupBucket) {
                    $countQuery->selectRaw("{$groupBucket[0]} as group_key", $groupBucket[1]);
                } else {
                    $countQuery->selectRaw("$groupCol as group_key");
                }
                $countQuery->selectRaw('COUNT(*) as aggregate_count');
                $groupBucket
                    ? $countQuery->groupByRaw($groupBucket[0], $groupBucket[1])
                    : $countQuery->groupBy($groupCol);

                // Key eksplisit 'null' (string) utk grup NULL -- array PHP
                // otomatis cast key null jadi '' ("" != frontend String(null)
                // === 'null'), pluck() polos jadi mismatch dgn lookup FE.
                // Kolom boolean: $row->group_key di sini nilai MENTAH dari SQL
                // (stdClass query builder, TIDAK lewat cast Eloquent) -- SQLite/
                // MySQL simpan sbg 0/1, sedangkan row asli (data.data, model
                // ter-hydrate) di-JSON-kan lewat cast 'boolean' jadi true/false
                // literal, dibaca FE via String(rawBoolean) => "true"/"false".
                // Tanpa normalisasi ini key "0"/"1" tidak pernah match "true"/
                // "false", groupCounts lookup selalu 0 (ketauan lewat browser).
                $isBooleanGroup = ($groupConfig['type'] ?? null) === 'boolean';
                $groupCounts    = $countQuery
                    ->get()
                    ->mapWithKeys(function ($row) use ($isBooleanGroup) {
                        $value = $row->group_key;
                        if ($isBooleanGroup && $value !== null) {
                            $value = ((bool) $value) ? 'true' : 'false';
                        }

                        return [(string) ($value ?? 'null') => (int) $row->aggregate_count];
                    })
                    ->all();
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
                'defaultSort' => '-created_at',
                // fid yang otomatis diterapkan tanpa ?fid= eksplisit (shared filter
                // default dari Filter Templates) — null bila request punya fid
                // sendiri atau tidak ada default utk model ini.
                'defaultFilterId'  => ! $request->filled('fid') ? $appliedFilter?->id : null,
                'name'             => $query->getModel()->getNameClass(),
                'translateKey'     => $query->getModel()->translateKey ?? null,
                'dataTableColumns' => $dataTableColumns,
                'groupCounts'      => $groupCounts,
            ]);
        });
    }
}
