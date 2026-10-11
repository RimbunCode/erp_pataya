<?php

namespace App\Services\Core\DataTable\Group;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Gate `groupable` -- kolom mana yang BOLEH jadi level group. Dipindah apa
 * adanya dari DataTableScope (spec datatable2-group-tree, task 3.1: refactor
 * murni, tanpa perubahan perilaku).
 */
class GroupColumnGate {
    /** Fungsi agregat yang boleh diset lewat `'groupAggregate'` di $configColumns. */
    public const AGGREGATE_FUNCTIONS = ['sum', 'avg', 'min', 'max'];

    /**
     * Kolom agregat baris grup (spec datatable2-group-tree, Requirement 9):
     * `'groupAggregate' => 'sum'|'avg'|'min'|'max'` di $configColumns -- HANYA
     * lewat kode, tanpa UI. Diabaikan DIAM-DIAM (bukan error) bila:
     * - fungsi di luar whitelist;
     * - tipe kolom bukan `number`/`currency` (otomatis menolak relasi/string);
     * - kolom TURUNAN (`derived`: accessor/`$appends`) -- bukan kolom SQL riil,
     *   SUM/AVG ke situ error "no such column". Sama dgn gate `groupable`:
     *   sengaja BUKAN dideteksi dari `dependsOn` (kolom fisik pun bisa punya);
     * - nama kolom bukan identifier sederhana (nama kolom masuk ke SQL, walau
     *   sudah di-wrap grammar).
     *
     * @param  array<int|string, array<string, mixed>>  $dataTableColumns
     * @return list<array{column: string, fn: string, sqlColumn: string}>
     */
    public static function aggregates(array $dataTableColumns): array {
        $aggregates = [];
        foreach ($dataTableColumns as $column) {
            $fn = $column['groupAggregate'] ?? null;
            if (! \is_string($fn) || ! \in_array($fn, self::AGGREGATE_FUNCTIONS, true)) {
                continue;
            }
            $name = $column['name'] ?? null;
            if (! \is_string($name)
                || ! \in_array($column['type'] ?? null, ['number', 'currency'], true)
                || ($column['derived'] ?? false)
                || ! \preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
                continue;
            }

            $aggregates[] = ['column' => $name, 'fn' => $fn, 'sqlColumn' => $name];
        }

        return $aggregates;
    }

    /**
     * Kolom SQL riil (GROUP BY / ORDER BY) utk kolom `type: relation`. Cuma
     * didukung utk BelongsTo -- FK-nya 1 kolom scalar di tabel model INI
     * sendiri, selalu merujuk 1 related class. HasOne/MorphOne (FK ada di
     * tabel LAIN, butuh JOIN) sengaja TIDAK didukung; MorphTo (butuh kombinasi
     * id+type, grouping lintas-tipe ambigu) HANYA bila config kolom `groupMorph:
     * true` -- null berarti "tidak bisa di-resolve ke 1 kolom", caller anggap
     * kolom itu not-groupable.
     */
    public static function relationSqlColumn(Model $model, array $columnConfig): ?string {
        $method = $columnConfig['nameOfFunction'] ?? null;
        if (! $method || ! \method_exists($model, $method)) {
            return null;
        }

        $relation = $model->$method();

        if (! $relation instanceof BelongsTo) {
            return null;
        }

        // MorphTo extends BelongsTo (Laravel) -- dikecualikan kecuali kolom opt-in
        // `groupMorph: true`: FK-nya cuma separuh kunci (id tanpa type), jadi hanya
        // aman bila id unik lintas tabel (ULID) -- keputusan sadar developer model
        // (spec asset-ownership-morph Requirement 7). Kunci grup = `{nama}_id`.
        if ($relation instanceof MorphTo) {
            return ($columnConfig['groupMorph'] ?? false) === true
                ? $relation->getForeignKeyName()
                : null;
        }

        return $relation->getForeignKeyName();
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
     *   lihat relationSqlColumn()).
     * - kolom TURUNAN (`derived`, ditandai LinkModel::computeColumnsFlat utk
     *   accessor/`$appends` & forceAppend): nilainya dihitung / berasal dari luar
     *   tabel, bukan kolom SQL model ini -- GROUP BY/ORDER BY ke situ error "no
     *   such column". Penting krn `groupable` bisa datang dari
     *   defaultConfigColumns berdasar NAMA kolom (mis. `status`) yg ternyata
     *   accessor di model tertentu. Sengaja BUKAN dideteksi dari `dependsOn`:
     *   kolom fisik pun bisa punya dependsOn (mis. PurchaseRequest::status).
     */
    public static function sanitizeColumns(array $dataTableColumns, Model $model): array {
        $excludedTypes = ['relations', 'json', 'mixed', 'html'];

        return \array_map(function ($column) use ($excludedTypes, $model) {
            if (! ($column['groupable'] ?? false)) {
                return $column;
            }

            $type = $column['type'] ?? null;
            if (($column['derived'] ?? false) || \in_array($type, $excludedTypes, true)) {
                $column['groupable'] = false;
            } elseif ($type === 'relation' && self::relationSqlColumn($model, $column) === null) {
                $column['groupable'] = false;
            }

            return $column;
        }, $dataTableColumns);
    }

    /**
     * Gate groupable utk SATU kandidat kolom grup: resolve config dari
     * $dataTableColumns (sudah lewat sanitizeColumns()) lalu, utk kolom
     * relasi, pastikan FK-nya bisa diresolve ke 1 kolom SQL
     * (relationSqlColumn()). Dipakai baik utk kolom grup AKTIF
     * (request/filter/default) maupun grup EFEKTIF-TANPA-PARAM yang
     * di-share ke FE (Requirement 12.6) -- 2 evaluasi terpisah karena bisa
     * berbeda saat `?group=` eksplisit meng-override kandidat filter/default.
     *
     * @param  array<string,mixed>|list<array<string,mixed>>  $dataTableColumns
     * @return array{config: ?array<string,mixed>, sqlColumn: ?string, isGroupable: bool}
     */
    public static function gate(mixed $candidate, array $dataTableColumns, Model $model): array {
        // Kandidat non-string (mis. `?group[]=` malformed) atau string kosong
        // diperlakukan sama spt "tak ada kandidat" -- tanpa ini, firstWhere()
        // dgn value array bisa membingungkan (bukan error, tapi tak berguna).
        $candidate   = \is_string($candidate) && $candidate !== '' ? $candidate : null;
        $config      = $candidate ? collect($dataTableColumns)->firstWhere('name', $candidate) : null;
        $isGroupable = (bool) ($config && ($config['groupable'] ?? false));
        $sqlColumn   = $isGroupable && ($config['type'] ?? null) === 'relation'
            ? self::relationSqlColumn($model, $config)
            : $candidate;
        $isGroupable = $isGroupable && $sqlColumn !== null;

        return ['config' => $config, 'sqlColumn' => $sqlColumn, 'isGroupable' => $isGroupable];
    }
}
