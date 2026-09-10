<?php

namespace App\Services\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOneOrMany;
use Illuminate\Database\Eloquent\Relations\MorphOneOrMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Menentukan kolom `SELECT` dan relasi `with()` yang minimal untuk sebuah
 * DataTable berdasarkan kolom yang sedang ditampilkan (visibleKeys).
 *
 * Sumber kebenaran tetap `dataTableColumns` (Model::getColumns(1)); cookie hanya
 * menandai kolom mana yang visible. Tidak mengakses Request/cookie — semua I/O
 * tersebut ditangani oleh pemanggil (DataTableScope).
 *
 * Aturan ringkas:
 *  - SELECT = PK + kolom DB visible (cek via Schema, apa pun type render) + FK relasi
 *    visible + dependsOn append visible + extraKeys.
 *  - with   = relasi VISIBLE saja (relasi yang hanya difilter/disort tidak ikut).
 *  - Kolom `forceAppend` (virtual dari global scope join) di-skip — disediakan scope.
 *  - Kolom non-DB yang bukan relasi & bukan forceAppend (append accessor / type
 *    di-override) WAJIB punya `dependsOn`; bila tidak → throw (non-produksi) atau
 *    log + fallbackAll (produksi).
 *  - fallbackAll → pemanggil memakai `<table>.*` (perilaku lama), `with` tetap di-prune.
 *
 * @phpstan-type ColumnNode array<string,mixed>
 */
class DataTableColumnSelector {
    public function __construct(private FilterColumnResolver $resolver) {}

    /**
     * Normalisasi peta `with` ({rel => Closure|null}) ke bentuk argumen Eloquent
     * `with()`: relasi dgn closure child-select → keyed (`rel => Closure`); relasi
     * null (morph / tanpa info child) → entri numeric (`rel`) agar di-eager-load
     * APA ADANYA tanpa closure (penting: closure no-op merusak eager-load morphTo).
     *
     * @param  array<string, \Closure|null>  $withMap
     * @return array<int|string, \Closure|string>
     */
    public static function withArray(array $withMap): array {
        $out = [];
        foreach ($withMap as $rel => $closure) {
            if ($closure instanceof \Closure) {
                $out[$rel] = $closure;
            } else {
                $out[] = $rel;
            }
        }

        return $out;
    }

    /**
     * Filter `$appends` tiap model ke hanya accessor yang visible di `$safeColumns`.
     * Idempoten: `setAppends([])` valid bila tidak ada accessor yang visible.
     *
     * `LengthAwarePaginator` dicek sebelum `Collection` karena paginator bukan
     * subclass Collection — match akan salah dispatch bila urutannya terbalik.
     *
     * @param  array<int|string, array<string, mixed>>  $dataTableColumns  hasil getColumns(1)
     * @param  array<string, bool>  $safeColumns  kolom visible {nama => true}
     */
    public static function applyAppends(
        Model|Collection|LengthAwarePaginator $target,
        array $dataTableColumns,
        array $safeColumns,
    ): void {
        $byName = collect($dataTableColumns)->keyBy('name');
        $needed = array_keys(array_filter(
            $safeColumns,
            fn ($_, $name) => static::isAppendColumn($byName->get($name)),
            ARRAY_FILTER_USE_BOTH,
        ));

        $apply = fn (Model $m) => $m->setAppends($needed);

        match (true) {
            $target instanceof LengthAwarePaginator => $target->getCollection()->each($apply),
            $target instanceof Collection           => $target->each($apply),
            default                                 => $apply($target),
        };
    }

    /**
     * Tentukan apakah kolom butuh `setAppends()` agar accessor-nya terpanggil.
     * `type === 'attribute'` (baseline default `LinkModel::getColumns` untuk
     * append native) selalu ikut. Kolom custom (mis. `type` di-override manual
     * di configColumns, seperti kolom bertipe 'image' berbasis accessor) ikut
     * juga SELAMA ia bukan relasi (`nameOfFunction` tak ada) dan bukan kolom DB
     * fisik (`dependsOn` jadi sinyal wajib: field non-DB WAJIB dependsOn, lihat
     * `collectAppendStrict`) — tanpa dependsOn berarti kolom DB/relasi biasa,
     * tak butuh accessor sama sekali.
     *
     * @param  array<string, mixed>|null  $col
     */
    private static function isAppendColumn(?array $col): bool {
        if ($col === null) {
            return false;
        }
        if (($col['type'] ?? null) === 'attribute') {
            return true;
        }
        if (isset($col['nameOfFunction'])) {
            return false;
        }

        return isset($col['dependsOn']) && $col['dependsOn'] !== [];
    }

    /**
     * Konversi `visibleKeys` cookie (index) → himpunan kolom-aman {nama => true}
     * untuk dipakai `resolveForSafe`. Cookie kosong → semua kolom `show !== false`
     * (perilaku default lama). Key ber-dot direduksi ke head. `$extraKeys` (sort
     * lokal non-visible) ikut disertakan.
     *
     * @param  array<int|string, array<string, mixed>>  $dataTableColumns
     * @param  array<int, string>|null  $visibleKeys
     * @param  array<int, string>  $extraKeys
     * @return array<string, bool>
     */
    public function safeColumnsFromVisible(array $dataTableColumns, ?array $visibleKeys, array $extraKeys = []): array {
        $byName = $this->indexByName($dataTableColumns);
        $safe   = [];
        foreach ($this->effectiveVisibleHeads($byName, $visibleKeys) as $head) {
            $safe[$head] = true;
        }
        foreach ($extraKeys as $key) {
            if (is_string($key) && $key !== '' && ! str_contains($key, '.')) {
                $safe[$key] = true;
            }
        }

        return $safe;
    }

    /**
     * Varian "kolom aman" dari `resolve()` untuk lookup SELECT-level DAN index
     * (konvergensi). Input adalah HIMPUNAN KOLOM AMAN ({nama => true}) — bukan
     * `visibleKeys` cookie — sehingga DB hanya membaca kolom yang diizinkan.
     *
     * Berbeda dgn `resolve()`:
     *  - TANPA `fallbackAll` (strict): append tanpa `dependsOn` → throw selalu.
     *  - `with` memetakan relasi non-morph → closure child-select dari
     *    `$safeRelationColumns[rel]`; relasi morph → tanpa closure (child `SELECT *`,
     *    tak bisa di-prune karena tabel berbeda per-baris).
     *  - templateLink di-resolve nested rekursif (Arah A) via `resolveTemplateLink`.
     *
     * @param  array<int|string, array<string, mixed>>  $dataTableColumns  Hasil Model::getColumns(1).
     * @param  array<string, bool>  $safeColumns  Kolom aman model utama (key = nama).
     * @param  array<string, array<string, bool>>  $safeRelationColumns  Relasi => kolom aman child.
     * @param  string|null  $templateLink  templateLink model (placeholder wajib ikut select/with).
     * @return array{select: list<string>, with: array<string, \Closure|null>}
     */
    public function resolveForSafe(
        array $dataTableColumns,
        Model $model,
        array $safeColumns,
        array $safeRelationColumns,
        ?string $templateLink,
    ): array {
        $byName    = $this->indexByName($dataTableColumns);
        $dbColumns = $this->dbColumns($model);

        $pk     = $model->getKeyName();
        $table  = $model->getTable();
        $select = ["{$table}.{$pk}"];
        $with   = [];

        foreach (array_keys($safeColumns) as $name) {
            $col  = $byName[$name] ?? null;
            $type = $col['type'] ?? null;

            if ($col === null) {
                // Tak ada di metadata — bila kolom DB nyata tetap SELECT (mis. id/PK).
                // Skip PK — sudah di-select dengan prefix tabel di atas.
                if ($name !== $pk && in_array($name, $dbColumns, true)) {
                    $select[] = "{$table}.{$name}";
                }

                continue;
            }

            // Relasi singular (relation) & plural (relations) sama-sama di-collect:
            // collectSafeRelation membuat closure child-select dari kolom-aman child
            // (safeRelationColumns) bila ada — sehingga relasi yang diminta `with`
            // ikut ter-eager-load DAN kolom anaknya tersaring di level SELECT.
            // Bila tak ada child-safe (mis. index view yg suplai []), childSelectClosure
            // return null → eager-load apa adanya (SELECT * child), perilaku lama aman.
            if ($type === 'relation' || $type === 'relations') {
                $this->collectSafeRelation($model, $col, $name, $safeRelationColumns, $select, $with);

                continue;
            }

            // Virtual scope join — disediakan scope, jangan select & jangan throw.
            if (($col['forceAppend'] ?? false) === true) {
                continue;
            }

            // Kolom DB nyata (apa pun type render) → SELECT langsung.
            if (in_array($col['name'] ?? $name, $dbColumns, true)) {
                $select[] = "{$table}." . ($col['name'] ?? $name);

                continue;
            }

            // Sisanya accessor/append → wajib dependsOn (strict: throw bila tidak).
            $this->collectAppendStrict($model, $col, $safeRelationColumns, $select, $with);
        }

        // templateLink (Arah A): nested rekursif, cycle-guarded.
        $visited = [];
        $this->resolveTemplateLink($model, $templateLink, $safeRelationColumns, $select, $with, $visited, 0);

        return [
            'select' => array_values(array_unique($select)),
            'with'   => $with,
        ];
    }

    /**
     * Relasi aman → `with` + FK/morph type ke select. Non-morph → closure
     * child-select dari kolom aman relasi; morph → null (child `SELECT *`).
     *
     * `$safeName` adalah key snake_case (`$col['name']`) — konsisten dgn key yang
     * dipakai `safeRelationColumns` (dibangun `ModelController::safeRelationColumns`
     * dari `relatedModelMap`, snake). `$fn` (nameOfFunction, camelCase) dipakai
     * KHUSUS untuk key `$with`/pemanggilan method PHP — keduanya bisa BEDA (mis.
     * `templatedChildren` vs `templated_children`); memakai `$fn` untuk lookup
     * `$safeRelationColumns` akan selalu miss dan diam-diam mendegradasi child
     * select ke "tanpa info relasi nested" (FK relasi cucu tak ke-SELECT).
     *
     * @param  array<string, mixed>  $col
     * @param  array<string, array<string, bool>>  $safeRelationColumns
     * @param  list<string>  $select
     * @param  array<string, \Closure|null>  $with
     */
    private function collectSafeRelation(Model $model, array $col, string $safeName, array $safeRelationColumns, array &$select, array &$with): void {
        $fn = $col['nameOfFunction'] ?? $col['name'] ?? null;
        if (! is_string($fn) || ! method_exists($model, $fn)) {
            return;
        }

        $relation = $model->{$fn}();
        $table    = $model->getTable();

        if ($relation instanceof MorphTo) {
            $select[] = "{$table}." . $relation->getForeignKeyName();
            $select[] = "{$table}." . $relation->getMorphType();
            $with[$fn] ??= null; // morph: tak bisa prune child.

            return;
        }

        if ($relation instanceof BelongsTo) {
            $select[] = "{$table}." . $relation->getForeignKeyName();
        }

        // Relasi has-many/has-one (termasuk morph plural): FK (dan morph type)
        // ada di tabel CHILD, bukan parent. Eloquent butuh kolom-kolom itu di
        // SELECT child agar bisa menghidrasi & mencocokkan ke parent — kalau tak
        // di-select, relasi balik kosong. Kumpulkan untuk dipaksa masuk closure.
        $childKeys = [];
        if ($relation instanceof HasOneOrMany) {
            $childKeys[] = $relation->getForeignKeyName();
            if ($relation instanceof MorphOneOrMany) {
                $childKeys[] = $relation->getMorphType();
            }
        }

        $childSafe = $safeRelationColumns[$safeName] ?? null;
        $with[$fn] = $this->childSelectClosure($model, $fn, $childSafe, $childKeys);
    }

    /**
     * Closure child-select: `fn ($q) => $q->select([kolom aman child + PK + FK +
     * kolom render templateLink child])`. Kolom render dari `childClass::templateLink()`
     * disertakan agar label child (convertTemplateLink) tetap ter-render.
     *
     * Return `null` bila TIDAK ada info kolom child sama sekali (tak ada kolom-aman
     * eksplisit DAN child tanpa templateLink) → relasi di-`with` apa adanya (child
     * `SELECT *`), mempertahankan perilaku lama agar render tak kehilangan kolom.
     *
     * @param  array<string, bool>|null  $childSafe
     * @param  list<string>  $childKeys  FK/morph-type di tabel child yang WAJIB
     *                                   di-select agar hidrasi has-many/morph jalan
     */
    private function childSelectClosure(Model $model, string $fn, ?array $childSafe, array $childKeys = []): ?\Closure {
        $relation    = $model->{$fn}();
        $related     = $relation->getRelated();
        $relatedKey  = $related->getKeyName();
        $safeColumns = array_keys($childSafe ?? []);

        // Kolom DB lokal child yang dirujuk templateLink child (label display).
        $relatedClass = get_class($related);
        $tpl          = method_exists($relatedClass, 'templateLink') ? $relatedClass::templateLink() : null;
        $tplColumns   = $this->templateLinkLocalColumns($tpl);

        // Accessor alias templateLink child (mis. Warehouse::title, Branch::title)
        // punya `dependsOn` sendiri di configColumns — bisa merujuk relasi
        // child-of-child (mis. `branch.code`). Tanpa ini, accessor tsb kehilangan
        // relasi yang ia butuhkan setiap kali model ini jadi RELASI (bukan ROOT),
        // karena regex templateLink biasa membuang alias `{:accessor}` sepenuhnya.
        $dependsInfo = $this->childAppendDependsCols($related, $tpl);
        $nestedWith  = $dependsInfo['with'];
        $safeAppends = $dependsInfo['appends'];

        // Placeholder templateLink child yang SENDIRI adalah relasi (mis.
        // ApprovalInstance::templateLink() = ':document', 'document' = morphTo)
        // — bukan kolom DB, bukan alias accessor. `templateLinkLocalColumns` hanya
        // menangkap string head; tanpa deteksi ini, head relasi dibuang saat
        // intersect dbColumns dan relasinya tak pernah di-with, sehingga label
        // child (mis. instance.document) selalu null walau data morph-nya ada.
        $relationHeadInfo = $this->childTemplateLinkRelationCols($related, $tpl);
        $nestedWith       = array_merge($nestedWith, $relationHeadInfo['with']);

        $cols = array_values(array_unique([
            ...$safeColumns,
            ...$tplColumns,
            ...$dependsInfo['cols'],
            ...$relationHeadInfo['cols'],
        ]));
        // Tak ada info kolom child → jangan batasi (SELECT * child), seperti lama.
        if ($cols === []) {
            return null;
        }

        // SELECT presisi child HANYA boleh kolom DB nyata — templateLink bisa
        // merujuk accessor (mis. File::':fullname'), yang akan memicu SQL error.
        // Intersect dgn kolom DB child membuang accessor (di-resolve dari
        // $appends/dependsOn saat hidrasi, bukan SELECT langsung).
        $childDbColumns = $this->dbColumns($related);
        $cols           = array_values(array_intersect($cols, $childDbColumns));

        // FK relasi BelongsTo aman di child wajib ikut agar nested eager-loading jalan.
        // $childSafe bisa punya relasi (mis. 'item', 'unit') — FK-nya (item_id, item_unit_id)
        // harus di-SELECT agar Eloquent bisa match nested with(['items.item']).
        // Map snake_name → nameOfFunction dari getColumns child (sumber kebenaran).
        $childColByName = method_exists($relatedClass, 'getColumns')
            ? collect($relatedClass::getColumns(1, true))->keyBy('name')->all()
            : [];
        foreach (array_keys($childSafe ?? []) as $childRelName) {
            // safe key snake_case; nameOfFunction dari getColumns adalah method PHP asli.
            $methodName = $childColByName[$childRelName]['nameOfFunction']
                ?? (method_exists($related, $childRelName) ? $childRelName : null);
            if ($methodName === null) {
                continue;
            }
            try {
                $childRel = $related->{$methodName}();
            } catch (\Throwable) {
                continue;
            }
            if ($childRel instanceof BelongsTo) {
                $fk = $childRel->getForeignKeyName();
                if (in_array($fk, $childDbColumns, true)) {
                    $cols[] = $fk;
                }
            }
        }

        // PK + FK/morph-type child wajib ikut (hidrasi & match ke parent).
        $cols[] = $relatedKey;
        foreach ($childKeys as $key) {
            if (is_string($key) && $key !== '') {
                $cols[] = $key;
            }
        }
        // Kolom yang global scope rujuk (soft delete, is_example, dll) wajib ikut
        // agar WHERE scope tak menabrak kolom yang tak di-SELECT pada DB tertentu.
        foreach ($this->scopeColumns($related) as $key) {
            if (in_array($key, $childDbColumns, true)) {
                $cols[] = $key;
            }
        }
        $cols = array_values(array_unique($cols));

        // Qualify dgn nama tabel child: relasi *ToMany (belongsToMany/morphToMany)
        // JOIN tabel pivot, sehingga kolom seperti `deleted_at`/`id` ambigu antara
        // tabel child & pivot. Prefix tabel child menghilangkan ambiguitas dan tetap
        // valid untuk relasi non-pivot (hasMany/belongsTo).
        $childTable = $related->getTable();
        $cols       = array_map(fn ($c) => "{$childTable}.{$c}", $cols);

        // Relasi child-of-child yang dibutuhkan dependsOn accessor templateLink
        // (mis. `branch` utk Warehouse::title) — eager-load DI DALAM closure child
        // ini sendiri, via withArray (null entries → eager-load apa adanya).
        $nestedWithArgs = self::withArray($nestedWith);

        // $q adalah Relation (BelongsTo/HasMany/...) saat dipakai di with([rel => fn]);
        // select() diproksikan ke Builder via __call. Jangan type-hint Builder.
        // afterQuery: blank-slate appends bawaan class (accessor yg butuh relasi ekstra
        // tak ter-load, mis. Supplier::getAddressAttribute → country, bisa crash saat
        // serialisasi) LALU definisikan ulang HANYA accessor templateLink yang
        // dependsOn-nya sudah dipastikan ter-SELECT ($safeAppends) — pola sama dgn
        // DataTableColumnSelector::applyAppends() utk model ROOT. Tanpa langkah kedua
        // ini, label (mis. Branch::title/Warehouse::title) hilang total dari response
        // setiap kali model tsb jadi relasi child (appends default ter-blank permanen).
        return function ($q) use ($cols, $nestedWithArgs, $safeAppends): void {
            $q->select($cols);
            if ($nestedWithArgs !== []) {
                $q->with($nestedWithArgs);
            }
            $q->afterQuery(fn ($items) => $items->each(fn ($m) => $m->setAppends($safeAppends)));
        };
    }

    /**
     * Kolom yang global scope umum (SoftDeletes, HasExampleData) rujuk di WHERE,
     * sehingga harus ikut di SELECT presisi child agar query tak menabrak kolom
     * tak-terselect. Konservatif: hanya nama kolom yang dipakai scope tsb.
     *
     * @return list<string>
     */
    private function scopeColumns(Model $model): array {
        $cols = [];
        if (method_exists($model, 'getDeletedAtColumn')) {
            $deletedAt = $model->getDeletedAtColumn();
            if (is_string($deletedAt) && $deletedAt !== '') {
                $cols[] = $deletedAt;
            }
        }
        // HasExampleData mendaftarkan global scope `where is_example = false` --
        // tapi scope itu sendiri sudah defensive (skip kalau kolom tak ada, lihat
        // HasExampleData::bootHasExampleData). Cek di sini juga, supaya table yang
        // belum punya kolom (mis. belum diadopsi via migration) tidak ikut di-SELECT
        // dan bikin query "no such column".
        if (Schema::hasColumn($model->getTable(), 'is_example')) {
            $cols[] = 'is_example';
        }

        return $cols;
    }

    /**
     * Kolom DB lokal (head segmen pertama, non-relasi-nested) yang dirujuk
     * templateLink — untuk child-select label. `:name` → `name`; `:a.b` → `a`
     * (relasi nested child ditangani Arah A terpisah, di sini hanya head lokal).
     *
     * @return list<string>
     */
    private function templateLinkLocalColumns(?string $templateLink): array {
        if (! is_string($templateLink) || $templateLink === '') {
            return [];
        }
        $out = [];
        if (preg_match_all('/:((\w[\w]+\{:[\w.]+\})|(\w[\w.]+))/', $templateLink, $matches)) {
            foreach ($matches[1] as $raw) {
                // Alias `:nama{:alias}`: `nama` = kolom DB (queryable, di-SELECT);
                // `alias` = nilai tampil (accessor, TAK bisa di-query). Untuk SELECT
                // ambil `nama` (buang `{:alias}`) — render label pakai alias terpisah
                // via convertTemplateLink.
                $raw  = preg_replace('/\{:.*?\}/', '', $raw);
                $head = str_contains($raw, '.') ? explode('.', $raw)[0] : $raw;
                if ($head !== '') {
                    $out[] = $head;
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * Nama alias accessor (`:nama{:alias}` → `alias`) yang dirujuk templateLink.
     * Berpasangan dgn `templateLinkLocalColumns` (yang membuang alias) — dipakai
     * utk menemukan accessor (mis. Warehouse::title, Branch::title) yang perlu
     * di-resolve `dependsOn`-nya di child-select (lihat `childAppendDependsCols`).
     *
     * @return list<string>
     */
    private function templateLinkAliasAccessors(?string $templateLink): array {
        if (! is_string($templateLink) || $templateLink === '') {
            return [];
        }
        $out = [];
        if (preg_match_all('/\{:([\w.]+)\}/', $templateLink, $matches)) {
            foreach ($matches[1] as $alias) {
                if ($alias !== '') {
                    $out[] = $alias;
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * Resolusi `dependsOn` milik accessor alias templateLink child (mis.
     * `Warehouse::title` → `dependsOn: ['code','branch.code']`) menjadi kolom
     * lokal (masuk SELECT child) + relasi child-of-child yang wajib di-eager-load
     * DI DALAM closure child (mis. `branch`), TANPA harus diminta eksplisit lewat
     * `fields`/`with` FE — sama seperti `collectAppendStrict` menangani accessor
     * di model ROOT, hanya targetnya kini kolom/with LOKAL child, bukan
     * `$select`/`$with` milik resolveForSafe.
     *
     * TIDAK strict/throw: accessor tanpa `dependsOn` di sini cukup diabaikan
     * (`templateLinkLocalColumns` sudah menegakkan strict utk model ROOT; child
     * yang templateLink-nya tak lengkap dependsOn hanya kehilangan optimasi ini,
     * bukan pintu keamanan — dependsOn tetap wajib lewat audit `DependsOnAuditTest`
     * bila model tsb pernah jadi ROOT).
     *
     * `appends` = nama accessor yang `dependsOn`-nya berhasil di-resolve (kolom
     * sumbernya sudah dipastikan masuk `cols`/`with`) — dipakai pemanggil utk
     * `setAppends()` ULANG setelah `afterQuery` mengosongkan appends bawaan
     * class (lihat `childSelectClosure`): blank-slate lalu definisikan kembali
     * HANYA accessor yang aman, persis pola `DataTableColumnSelector::applyAppends`
     * utk model ROOT. Accessor tanpa `dependsOn` (baris `continue` di atas) TIDAK
     * masuk `appends` — tetap di-blank karena keamanannya tak terjamin.
     *
     * @return array{cols: list<string>, with: array<string, \Closure|null>, appends: list<string>}
     */
    private function childAppendDependsCols(Model $related, ?string $templateLink): array {
        $cols    = [];
        $with    = [];
        $appends = [];

        if (! is_string($templateLink) || $templateLink === '' || ! method_exists($related, 'getColumns')) {
            return ['cols' => $cols, 'with' => $with, 'appends' => $appends];
        }

        $relatedClass = get_class($related);
        $byName       = collect($relatedClass::getColumns(1, true))->keyBy('name');

        foreach ($this->templateLinkAliasAccessors($templateLink) as $accessor) {
            $dependsOn = $byName->get($accessor)['dependsOn'] ?? null;
            if (! is_array($dependsOn)) {
                continue;
            }
            $appends[] = $accessor;

            foreach ($dependsOn as $dep) {
                if (! is_string($dep) || $dep === '') {
                    continue;
                }
                if (! str_contains($dep, '.')) {
                    $cols[] = $dep;

                    continue;
                }
                $this->collectChildDependsRelation($related, $dep, $cols, $with);
            }
        }

        return [
            'cols'    => array_values(array_unique($cols)),
            'with'    => $with,
            'appends' => array_values(array_unique($appends)),
        ];
    }

    /**
     * Varian `collectSafeDependsRelation` yang menulis ke `$cols`/`$with` LOKAL
     * (dipakai di dalam closure child-select), bukan `$select`/`$with` milik
     * `resolveForSafe`. Tanpa kolom aman eksplisit (child-of-child tak diminta
     * FE) — child-select relasi ini dibatasi ke FK + PK saja lewat
     * `childSelectClosure($related, $first, null)` (aman, minimal, tak SELECT *).
     *
     * Resolver BARU (bukan `$this->resolver`, yang berskema kolom model ROOT) —
     * `$dep` di sini relatif terhadap skema `$related` (CHILD), butuh resolver
     * yang dibangun dari `$related::getColumns(1, true)` sendiri.
     *
     * @param  list<string>  $cols
     * @param  array<string, \Closure|null>  $with
     */
    private function collectChildDependsRelation(Model $related, string $dep, array &$cols, array &$with): void {
        if (! method_exists($related, 'getColumns')) {
            return;
        }
        $childResolver = new FilterColumnResolver($related::getColumns(1, true));
        $path          = $childResolver->resolvePath($dep);
        if ($path === null || $path['relations'] === []) {
            return;
        }
        $first = $path['relations'][0]['function'];
        if (! is_string($first) || ! method_exists($related, $first)) {
            return;
        }

        $relation = $related->{$first}();
        if ($relation instanceof MorphTo) {
            $cols[] = $relation->getForeignKeyName();
            $cols[] = $relation->getMorphType();
            $with[$first] ??= null;

            return;
        }
        if ($relation instanceof BelongsTo) {
            $cols[] = $relation->getForeignKeyName();
        }
        if (! ($relation instanceof Relation)) {
            return;
        }

        $existingClosure = $this->childSelectClosure($related, $first, null);
        $targetColumn    = $path['columnName'] ?? null;

        if ($targetColumn && $existingClosure) {
            $relatedClass = get_class($relation->getRelated());
            $relatedTable = (new $relatedClass)->getTable();
            $fullColumn   = "{$relatedTable}.{$targetColumn}";

            $with[$first] = function ($q) use ($existingClosure, $fullColumn): void {
                $existingClosure($q);
                $q->addSelect($fullColumn);
            };
        } else {
            $with[$first] = $existingClosure;
        }
    }

    /**
     * Placeholder templateLink child yang SEGMEN AKHIRNYA sendiri adalah relasi
     * (mis. `ApprovalInstance::templateLink() = ':document'`, `document` = morphTo),
     * bukan kolom scalar dan bukan alias `{:accessor}`. Beda dari
     * `childAppendDependsCols` (accessor alias) — di sini placeholder POLOS
     * (`:nama`, tanpa `{:...}`) yang ternyata method relasi di `$related`.
     *
     * Tanpa deteksi ini, `templateLinkLocalColumns` menangkap `document` sbg
     * string head biasa, lalu dibuang saat intersect `dbColumns` (bukan kolom
     * DB) — relasinya TAK PERNAH di-with, sehingga label child (mis.
     * `instance.document`) selalu `null` walau data morph-nya ada di DB.
     *
     * Reuse pola `resolveTemplateHead` (versi ROOT), hanya menulis ke `cols`/`with`
     * LOKAL closure child alih-alih `$select`/`$with` milik `resolveForSafe`.
     *
     * @return array{cols: list<string>, with: array<string, \Closure|null>}
     */
    private function childTemplateLinkRelationCols(Model $related, ?string $templateLink): array {
        $cols = [];
        $with = [];

        foreach (self::templateLinkPlaceholders($templateLink) as $placeholder) {
            // Dot-notation ditangani `collectChildDependsRelation`/`childAppendDependsCols`
            // lewat dependsOn; di sini khusus head POLOS (tanpa dot).
            if ($placeholder === '' || str_contains($placeholder, '.')) {
                continue;
            }
            if (! method_exists($related, $placeholder)) {
                continue;
            }
            $relation = $related->{$placeholder}();
            if (! ($relation instanceof Relation)) {
                continue;
            }

            if ($relation instanceof MorphTo) {
                $cols[] = $relation->getForeignKeyName();
                $cols[] = $relation->getMorphType();
                $with[$placeholder] ??= null; // morph: tak bisa prune child.

                continue;
            }
            if ($relation instanceof BelongsTo) {
                $cols[] = $relation->getForeignKeyName();
            }
            $with[$placeholder] = $this->childSelectClosure($related, $placeholder, null);
        }

        return ['cols' => array_values(array_unique($cols)), 'with' => $with];
    }

    /**
     * Append aman → proses `dependsOn`. STRICT: tanpa `dependsOn` → throw selalu
     * (tak ada fallbackAll). Entri ber-dot → relasi + FK ke with/select.
     *
     * @param  array<string, mixed>  $col
     * @param  array<string, array<string, bool>>  $safeRelationColumns
     * @param  list<string>  $select
     * @param  array<string, \Closure|null>  $with
     */
    private function collectAppendStrict(Model $model, array $col, array $safeRelationColumns, array &$select, array &$with): void {
        $dependsOn = $col['dependsOn'] ?? null;
        if (! is_array($dependsOn) || $dependsOn === []) {
            $name = $col['name'] ?? '(unknown)';

            throw new \RuntimeException(
                "DataTable append column '{$name}' tidak punya 'dependsOn' di configColumns. "
                . 'Tambahkan dependsOn agar kolom sumbernya bisa di-SELECT presisi.',
            );
        }

        $table = $model->getTable();
        foreach ($dependsOn as $dep) {
            if (! is_string($dep) || $dep === '') {
                continue;
            }
            if (! str_contains($dep, '.')) {
                $select[] = "{$table}.{$dep}";

                continue;
            }
            $this->collectSafeDependsRelation($model, $dep, $safeRelationColumns, $select, $with);
        }
    }

    /**
     * Entri `dependsOn` ber-dot (relasi.kolom) → relasi pertama ke `with` + FK ke
     * `select`, via FilterColumnResolver::resolvePath. Relasi non-morph dapat
     * closure child-select.
     *
     * @param  array<string, array<string, bool>>  $safeRelationColumns
     * @param  list<string>  $select
     * @param  array<string, \Closure|null>  $with
     */
    private function collectSafeDependsRelation(Model $model, string $dep, array $safeRelationColumns, array &$select, array &$with): void {
        $path = $this->resolver->resolvePath($dep);
        if ($path === null || $path['relations'] === []) {
            return;
        }
        $first     = $path['relations'][0]['function'];
        $firstSafe = $path['relations'][0]['name'] ?? $first;
        if (! is_string($first) || ! method_exists($model, $first)) {
            return;
        }

        $relation    = $model->{$first}();
        $parentTable = $model->getTable();

        if ($relation instanceof MorphTo) {
            $select[] = "{$parentTable}." . $relation->getForeignKeyName();
            $select[] = "{$parentTable}." . $relation->getMorphType();
            $with[$first] ??= null;

            return;
        }
        if ($relation instanceof BelongsTo) {
            $select[] = "{$parentTable}." . $relation->getForeignKeyName();
        }

        $existingClosure = $this->childSelectClosure($model, $first, $safeRelationColumns[$firstSafe] ?? null);
        $targetColumn    = $path['columnName'] ?? null;

        if ($targetColumn && $existingClosure) {
            $relatedClass = get_class($relation->getRelated());
            $relatedTable = (new $relatedClass)->getTable();
            $fullColumn   = "{$relatedTable}.{$targetColumn}";

            $with[$first] = function ($q) use ($existingClosure, $fullColumn): void {
                $existingClosure($q);
                $q->addSelect($fullColumn);
            };
        } else {
            $with[$first] = $existingClosure;
        }
    }

    /**
     * Resolusi templateLink → select kolom + relasi with secara REKURSIF (Arah A).
     * Tiap placeholder dot-notation di-resolve via resolvePath (with rantai + FK +
     * kolom akhir). Placeholder yang ujungnya relasi non-morph → rekursi ke
     * childClass::templateLink(). Cycle guard + depth cap = 4. Segmen morph →
     * berhenti, relasi morph tetap di-with (child `SELECT *`).
     *
     * @param  array<string, array<string, bool>>  $safeRelationColumns
     * @param  list<string>  $select
     * @param  array<string, \Closure|null>  $with
     * @param  array<string, bool>  $visited  FQCN model yang sudah dikunjungi (cycle guard)
     */
    private function resolveTemplateLink(Model $model, ?string $templateLink, array $safeRelationColumns, array &$select, array &$with, array &$visited, int $depth): void {
        if ($depth >= 4 || ! is_string($templateLink) || $templateLink === '') {
            return;
        }
        $fqcn = get_class($model);
        if (isset($visited[$fqcn])) {
            return;
        }
        $visited[$fqcn] = true;

        $dbColumns = $this->dbColumns($model);

        foreach (self::templateLinkPlaceholders($templateLink) as $placeholder) {
            if (! str_contains($placeholder, '.')) {
                // Head skalar / relasi top-level.
                $this->resolveTemplateHead($model, $placeholder, $safeRelationColumns, $dbColumns, $select, $with, $visited, $depth);

                continue;
            }
            // Dot-notation: telusuri rantai relasi penuh.
            $this->resolveTemplatePath($model, $placeholder, $safeRelationColumns, $select, $with, $visited, $depth);
        }
    }

    /**
     * Head placeholder top-level (tanpa dot): kolom DB → select; relasi → with +
     * FK + rekursi templateLink child; append → dependsOn.
     *
     * @param  array<string, array<string, bool>>  $safeRelationColumns
     * @param  list<string>  $dbColumns
     * @param  list<string>  $select
     * @param  array<string, \Closure|null>  $with
     * @param  array<string, bool>  $visited
     */
    private function resolveTemplateHead(Model $model, string $head, array $safeRelationColumns, array $dbColumns, array &$select, array &$with, array &$visited, int $depth): void {
        $table = $model->getTable();

        if (in_array($head, $dbColumns, true)) {
            $select[] = "{$table}.{$head}";

            return;
        }
        if (! method_exists($model, $head)) {
            return;
        }
        $relation = $model->{$head}();
        if ($relation instanceof MorphTo) {
            $select[] = "{$table}." . $relation->getForeignKeyName();
            $select[] = "{$table}." . $relation->getMorphType();
            $with[$head] ??= null;

            return;
        }
        if ($relation instanceof BelongsTo) {
            $select[] = "{$table}." . $relation->getForeignKeyName();
        }
        if (! ($relation instanceof Relation)) {
            return;
        }
        // `$head` adalah nama method PHP (bisa camelCase); safeRelationColumns
        // di-key snake_case (konsisten dgn ModelController::relatedModelMap).
        $with[$head] = $this->childSelectClosure($model, $head, $safeRelationColumns[Str::snake($head)] ?? null);
    }

    /**
     * Placeholder dot-notation (`a.b.c`): relasi tiap segmen ke with + FK; kolom
     * akhir di model terdalam ikut child-select (lewat safeRelationColumns).
     *
     * @param  array<string, array<string, bool>>  $safeRelationColumns
     * @param  list<string>  $select
     * @param  array<string, \Closure|null>  $with
     * @param  array<string, bool>  $visited
     */
    private function resolveTemplatePath(Model $model, string $placeholder, array $safeRelationColumns, array &$select, array &$with, array &$visited, int $depth): void {
        $path = $this->resolver->resolvePath($placeholder);
        if ($path === null || $path['relations'] === []) {
            return;
        }
        $first     = $path['relations'][0]['function'];
        $firstSafe = $path['relations'][0]['name'] ?? $first;
        if (! is_string($first) || ! method_exists($model, $first)) {
            return;
        }
        $relation    = $model->{$first}();
        $parentTable = $model->getTable();

        if ($relation instanceof MorphTo) {
            $select[] = "{$parentTable}." . $relation->getForeignKeyName();
            $select[] = "{$parentTable}." . $relation->getMorphType();
            $with[$first] ??= null;

            return;
        }
        if ($relation instanceof BelongsTo) {
            $select[] = "{$parentTable}." . $relation->getForeignKeyName();
        }
        $with[$first] = $this->childSelectClosure($model, $first, $safeRelationColumns[$firstSafe] ?? null);
    }

    /**
     * Ekstrak placeholder utuh (boleh dot-notation) dari templateLink untuk
     * penelusuran rantai relasi & SELECT. Alias `:nama{:alias}` → pakai `nama`
     * (kolom DB queryable yang di-SELECT/ditelusuri), BUKAN `alias` (nilai tampil
     * accessor yang tak bisa di-query). Render label pakai `alias` terpisah via
     * convertTemplateLink. Path utuh (dot-notation) dipertahankan untuk telusur relasi.
     *
     * @return list<string>
     */
    public static function templateLinkPlaceholders(?string $templateLink): array {
        if (! is_string($templateLink) || $templateLink === '') {
            return [];
        }

        $out = [];
        if (preg_match_all('/:((\w[\w]+\{:[\w.]+\})|(\w[\w.]+))/', $templateLink, $matches)) {
            foreach ($matches[1] as $raw) {
                $raw = preg_replace('/\{:.*?\}/', '', $raw);
                if ($raw !== '') {
                    $out[] = $raw;
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * Cache nama kolom DB per tabel (dalam satu request) — `Schema::getColumnListing`
     * membaca skema sehingga mahal bila diulang.
     *
     * @var array<string, list<string>>
     */
    private static array $dbColumnsCache = [];

    /**
     * Daftar nama kolom DB nyata milik tabel model. Dipakai untuk memastikan
     * hanya kolom DB asli yang masuk SELECT (bukan accessor yang type-nya
     * di-override jadi skalar, mis. rent_date).
     *
     * @return list<string>
     */
    private function dbColumns(Model $model): array {
        $table = $model->getTable();
        if (! isset(self::$dbColumnsCache[$table])) {
            self::$dbColumnsCache[$table] = Schema::getColumnListing($table);
        }

        return self::$dbColumnsCache[$table];
    }

    /**
     * Index kolom by name (mendukung array list maupun keyed).
     *
     * @param  array<int|string, array<string, mixed>>  $columns
     * @return array<string, array<string, mixed>>
     */
    private function indexByName(array $columns): array {
        $out = [];
        foreach ($columns as $key => $col) {
            if (! is_array($col)) {
                continue;
            }
            $name = $col['name'] ?? (is_string($key) ? $key : null);
            if (is_string($name)) {
                $out[$name] = $col;
            }
        }

        return $out;
    }

    /**
     * Himpunan kolom top-level yang efektif visible. Dari cookie bila ada; selain
     * itu HANYA kolom yang `show === true` eksplisit. configColumns adalah katalog
     * metadata (semua relasi/attribute didaftarkan agar dikenali fitur lain) —
     * terdaftar TAK berarti dibutuhkan. Indikator butuh: `show:true` atau diminta
     * client (cookie/fields/with). Default (`show` tak diset) → TIDAK visible,
     * supaya relasi metadata-only (files/tags/logs) tak ikut ter-load/prune.
     * Key ber-dot direduksi ke segmen pertama; key asing diabaikan di pemanggil.
     *
     * @param  array<string, array<string, mixed>>  $byName
     * @param  array<int, string>|null  $visibleKeys
     * @return list<string>
     */
    private function effectiveVisibleHeads(array $byName, ?array $visibleKeys): array {
        if ($visibleKeys === null || $visibleKeys === []) {
            $heads = [];
            foreach ($byName as $name => $col) {
                if (($col['show'] ?? false) === true || ($col['forceSelect'] ?? false) === true) {
                    $heads[] = $name;
                }
            }

            return $heads;
        }

        $heads = [];
        foreach ($visibleKeys as $key) {
            if (! is_string($key) || $key === '') {
                continue;
            }
            $heads[] = str_contains($key, '.') ? explode('.', $key)[0] : $key;
        }

        // forceSelect selalu ikut SELECT meski tidak ada di cookie visibleKeys.
        foreach ($byName as $name => $col) {
            if (($col['forceSelect'] ?? false) === true) {
                $heads[] = $name;
            }
        }

        return array_values(array_unique($heads));
    }
}
