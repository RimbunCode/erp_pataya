<?php

namespace App\Services\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Menentukan kolom `SELECT` dan relasi `with()` yang minimal untuk sebuah
 * DataTable berdasarkan kolom yang sedang ditampilkan (visibleKeys).
 *
 * Sumber kebenaran tetap `dataTableColumns` (Model::getColumns(1)); cookie hanya
 * menandai kolom mana yang visible. Tidak mengakses Request/cookie — semua I/O
 * tersebut ditangani oleh pemanggil (DataTableScope).
 *
 * Aturan ringkas:
 *  - SELECT = PK + kolom skalar visible + FK relasi visible + dependsOn append visible + extraKeys.
 *  - with   = relasi VISIBLE saja (relasi yang hanya difilter/disort tidak ikut).
 *  - Append (`attribute`) visible WAJIB punya `dependsOn`; bila tidak → throw
 *    (non-produksi) atau log + fallbackAll (produksi).
 *  - fallbackAll → pemanggil memakai `<table>.*` (perilaku lama), `with` tetap di-prune.
 *
 * @phpstan-type ColumnNode array<string,mixed>
 */
class DataTableColumnSelector {
    /**
     * Tipe kolom skalar yang merupakan kolom DB nyata (boleh masuk SELECT).
     *
     * @var list<string>
     */
    private const SCALAR_TYPES = [
        'string', 'number', 'integer', 'float', 'date', 'datetime', 'boolean', 'json',
    ];

    public function __construct(private FilterColumnResolver $resolver) {}

    /**
     * @param  array<int|string, array<string, mixed>>  $dataTableColumns  Hasil Model::getColumns(1).
     * @param  array<int, string>|null  $visibleKeys  Nama kolom visible dari cookie; null/[] => default config.
     * @param  array<int, string>  $extraKeys  Kolom skalar lokal yang wajib ikut SELECT walau tak visible
     *                                         (mis. kolom sort non-visible). Tidak menambah `with`.
     * @return array{select: list<string>, with: list<string>, fallbackAll: bool}
     */
    public function resolve(array $dataTableColumns, Model $model, ?array $visibleKeys, array $extraKeys = []): array {
        $byName       = $this->indexByName($dataTableColumns);
        $visibleHeads = $this->effectiveVisibleHeads($byName, $visibleKeys);
        $dbColumns    = $this->dbColumns($model);

        $pk          = $model->getKeyName();
        $select      = [$pk];
        $with        = [];
        $fallbackAll = false;

        foreach ($visibleHeads as $head) {
            $col  = $byName[$head] ?? null;
            $type = $col['type'] ?? null;

            if ($col === null) {
                continue; // key asing (model lain) — abaikan.
            }

            // Hanya relasi singular (`relation`: BelongsTo/HasOne/MorphTo/MorphOne)
            // yang di-eager-load default — meniru perilaku lama. Relasi plural
            // (`relations`: HasMany/MorphMany) tidak otomatis di-with (bisa via ?with).
            if ($type === 'relation') {
                $this->collectRelation($model, $col, $select, $with);

                continue;
            }
            if ($type === 'relations') {
                continue;
            }

            // Kolom skalar yang benar-benar kolom DB → SELECT langsung.
            if (in_array($type, self::SCALAR_TYPES, true) && in_array($col['name'], $dbColumns, true)) {
                $select[] = $col['name'];

                continue;
            }

            // Sisanya (append `attribute`, ATAU "skalar" yang ternyata bukan kolom
            // DB karena type di-override, mis. rent_date) = turunan accessor →
            // wajib `dependsOn`. Gagal → fallbackAll.
            if (! $this->collectAppend($model, $col, $select, $with)) {
                $fallbackAll = true;
            }
        }

        // Kolom sort lokal non-visible: ikut SELECT saja (bila kolom DB nyata), tak menambah `with`.
        foreach ($extraKeys as $key) {
            if ($key === '' || str_contains($key, '.')) {
                continue;
            }
            $col = $byName[$key] ?? null;
            if ($col !== null
                && in_array($col['type'] ?? null, self::SCALAR_TYPES, true)
                && in_array($col['name'], $dbColumns, true)) {
                $select[] = $col['name'];
            }
        }

        // Anomali: SELECT efektif hanya berisi PK (tak ada kolom DB lain) padahal
        // ada head non-relasi yang seharusnya tampil → aman pakai `*`.
        $nonPkSelect = array_values(array_filter(array_unique($select), fn ($c) => $c !== $pk));
        if ($nonPkSelect === [] && $this->hasNonRelationHead($byName, $visibleHeads)) {
            $fallbackAll = true;
        }

        return [
            'select'      => array_values(array_unique($select)),
            'with'        => array_values(array_unique($with)),
            'fallbackAll' => $fallbackAll,
        ];
    }

    /**
     * Relasi visible → tambahkan ke `with`; FK BelongsTo/morph ke `select`.
     *
     * @param  array<string, mixed>  $col
     * @param  list<string>  $select
     * @param  list<string>  $with
     */
    private function collectRelation(Model $model, array $col, array &$select, array &$with): void {
        $fn = $col['nameOfFunction'] ?? $col['name'] ?? null;
        if (! is_string($fn) || ! method_exists($model, $fn)) {
            return;
        }
        $with[] = $fn;

        $relation = $model->{$fn}();
        if ($relation instanceof MorphTo) {
            $select[] = $relation->getForeignKeyName();
            $select[] = $relation->getMorphType();
        } elseif ($relation instanceof BelongsTo) {
            $select[] = $relation->getForeignKeyName();
        }
        // HasOne/HasMany/Morph*Many: cukup PK induk (sudah ada).
    }

    /**
     * Append visible → proses `dependsOn`. Return false bila gagal (tak ada
     * `dependsOn`) agar pemanggil set fallbackAll.
     *
     * @param  array<string, mixed>  $col
     * @param  list<string>  $select
     * @param  list<string>  $with
     */
    private function collectAppend(Model $model, array $col, array &$select, array &$with): bool {
        $dependsOn = $col['dependsOn'] ?? null;
        if (! is_array($dependsOn) || $dependsOn === []) {
            $name = $col['name'] ?? '(unknown)';
            $msg  = "DataTable append column '{$name}' tidak punya 'dependsOn' di configColumns. "
                  . 'Tambahkan dependsOn agar kolom sumbernya bisa di-SELECT presisi.';

            if (! app()->isProduction()) {
                throw new \RuntimeException($msg);
            }
            Log::warning($msg);

            return false;
        }

        foreach ($dependsOn as $dep) {
            if (! is_string($dep) || $dep === '') {
                continue;
            }
            if (! str_contains($dep, '.')) {
                $select[] = $dep; // kolom lokal

                continue;
            }
            $this->collectDependsRelation($model, $dep, $select, $with);
        }

        return true;
    }

    /**
     * Entri `dependsOn` ber-dot (relasi.kolom) → relasi (segmen pertama) ke
     * `with` + FK relasi ke `select`, via FilterColumnResolver::resolvePath.
     *
     * @param  list<string>  $select
     * @param  list<string>  $with
     */
    private function collectDependsRelation(Model $model, string $dep, array &$select, array &$with): void {
        $path = $this->resolver->resolvePath($dep);
        if ($path === null || $path['relations'] === []) {
            return;
        }
        $first = $path['relations'][0]['function'];
        if (! is_string($first) || ! method_exists($model, $first)) {
            return;
        }
        $with[] = $first;

        $relation = $model->{$first}();
        if ($relation instanceof MorphTo) {
            $select[] = $relation->getForeignKeyName();
            $select[] = $relation->getMorphType();
        } elseif ($relation instanceof BelongsTo) {
            $select[] = $relation->getForeignKeyName();
        }
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
     * Himpunan kolom top-level yang efektif visible. Dari cookie bila ada;
     * selain itu kolom config `show !== false`. Key ber-dot direduksi ke segmen
     * pertama; key asing (tak ada di metadata) diabaikan di pemanggil.
     *
     * @param  array<string, array<string, mixed>>  $byName
     * @param  array<int, string>|null  $visibleKeys
     * @return list<string>
     */
    private function effectiveVisibleHeads(array $byName, ?array $visibleKeys): array {
        if ($visibleKeys === null || $visibleKeys === []) {
            $heads = [];
            foreach ($byName as $name => $col) {
                if (($col['show'] ?? true) !== false) {
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

        return array_values(array_unique($heads));
    }

    /**
     * Apakah ada head non-relasi (skalar/append) di antara yang visible — dipakai
     * untuk membedakan "memang tak ada kolom" vs "semua relasi" saat guard anomali.
     *
     * @param  array<string, array<string, mixed>>  $byName
     * @param  list<string>  $visibleHeads
     */
    private function hasNonRelationHead(array $byName, array $visibleHeads): bool {
        foreach ($visibleHeads as $head) {
            $type = $byName[$head]['type'] ?? null;
            if ($type !== null && ! in_array($type, ['relation', 'relations'], true)) {
                return true;
            }
        }

        return false;
    }
}
