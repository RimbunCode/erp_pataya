<?php

namespace App\Services\Core;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ReflectionClass;

class DataTableConfigValidator {
    /**
     * Validasi config model dan kumpulkan pelanggaran.
     *
     * @return array<int, array{rule:int, column?:string, message:string}>
     */
    public static function validate(string $modelClass): array {
        $violations = [];

        if (! class_exists($modelClass) || ! is_subclass_of($modelClass, EloquentModel::class)) {
            return $violations;
        }

        if (! in_array(LinkModel::class, class_uses_recursive($modelClass), true)) {
            return $violations;
        }

        $instance = new $modelClass;
        $columns  = $modelClass::computeColumnsFlat(true);

        $dbColumns = [];
        try {
            $dbColumns = Schema::getColumnListing($instance->getTable());
        } catch (\Throwable) {
        }

        // configColumns/defaultConfigColumns dideklarasikan `protected` di SEMUA
        // model (konvensi codebase) — validator ini class terpisah, bukan bagian
        // hierarki Model, jadi akses langsung ($instance->configColumns) gagal
        // diam-diam via operator ?? (PHP menekan error visibility, fallback []).
        // Baca via Reflection supaya validasi benar-benar jalan.
        $ownConfigColumns = static::readProtectedProperty($instance, 'configColumns') ?? [];
        $configColumns    = $modelClass::mergeConfigColumns(
            static::readProtectedProperty($instance, 'defaultConfigColumns') ?? [],
            $ownConfigColumns,
        );

        foreach ($columns as $col) {
            $name  = $col['name'] ?? null;
            $type  = $col['type'] ?? null;
            $isApp = ($type === 'attribute');
            $isFrc = isset($col['nameOfFunction']);

            if ($isApp && ! $isFrc) {
                $depOk = static::checkAppendDependsOn($col, $dbColumns, $configColumns);
                if ($depOk !== null) {
                    $violations[] = $depOk;
                }
            }

            $dep = $col['dependsOn'] ?? null;
            if (is_array($dep) && $dep !== []) {
                foreach ($dep as $d) {
                    $v = static::checkDependsOnResolvable($modelClass, $d, $columns, $dbColumns, $col);
                    if ($v !== null) {
                        $violations[] = $v;
                    }
                }
            }

            if ($isFrc) {
                $v = static::checkRelationValid($modelClass, $col, $instance);
                if ($v !== null) {
                    $violations[] = $v;
                }
            }
        }

        // Validasi ketat HANYA thd key yang dideklarasikan model itu SENDIRI
        // ($instance->configColumns) — BUKAN hasil merge dengan defaultConfigColumns
        // (superset generik LinkModel: is_example, have_transactions, lft/rgt/depth,
        // dst — berlaku lintas-model, banyak yang memang tidak relevan/tidak ada
        // di kolom model tertentu, itu bukan salah penamaan).
        foreach ($ownConfigColumns as $key => $config) {
            $key = is_string($key) ? $key : $config;

            // Urutan pengecekan (setiap key configColumns HARUS resolve ke tepat
            // satu dari ini — kalau tidak satupun cocok, itu error, TERLEPAS
            // dari ada/tidaknya 'type' eksplisit di config. Sinyal 'type' saja
            // tidak cukup: kalau developer lupa/salah menuliskannya, validator
            // sebelumnya ikut buta juga):
            // 1. Kolom DB fisik
            // 2. Attribute/accessor (Attribute::get() ATAU getXxxAttribute())
            // 3. Method relasi Eloquent (BelongsTo/HasMany/dst)
            // 4. Kolom hasil JOIN (addSelect di global scope, mis. ItemUnit::code
            //    dari tabel units — tidak ada di Schema::getColumnListing tabel
            //    model sendiri, tapi valid krn forceAppend/isJoinResult eksplisit)
            if (in_array($key, $dbColumns, true)) {
                continue; // Rule 1: kolom DB — valid
            }

            if ($instance->hasAttributeMutator($key) || $instance->hasAttributeGetMutator($key) || $instance->hasGetMutator($key)) {
                continue; // Rule 2: attribute/accessor — valid
            }

            $computedCol = collect($columns)->firstWhere('name', $key);
            if ($computedCol !== null && (($computedCol['forceAppend'] ?? false) || ($computedCol['isJoinResult'] ?? false))) {
                continue; // Rule 4: forceAppend/isJoinResult — valid
            }

            if (! method_exists($instance, $key)) {
                $violations[] = [
                    'rule'    => 3,
                    'column'  => $key,
                    'message' => "configColumns key '{$key}' tidak ditemukan sebagai kolom DB, attribute/accessor, maupun method relasi di model — kemungkinan salah penamaan atau field yang tidak eksis.",
                ];

                continue;
            }

            // Method protected/private (mis. appendStatus, appendCanDelete milik
            // trait LinkModel sendiri — accessor internal, BUKAN relasi Eloquent)
            // selalu throw BadMethodCallException generik kalau dipanggil dari
            // luar class via magic __call Eloquent, terlepas relasi atau bukan.
            // Skip validasi Rule 3 utk method non-public — bukan indikasi error.
            $methodReflection = new \ReflectionMethod($instance, $key);
            if (! $methodReflection->isPublic()) {
                continue;
            }

            try {
                $rel = $instance->$key();
                if (! $rel instanceof Relation) {
                    // Rule 3: method public ada tapi BUKAN relasi DAN bukan
                    // attribute (sudah dicek Rule 2 di atas) — ini janggal,
                    // tapi bukan tanggung jawab Rule 3 (validasi relasi) utk
                    // menghakimi method non-relasi sembarangan; biarkan lolos
                    // spt semula supaya tidak false-positive thd method utility.
                    continue;
                }
            } catch (\Throwable $e) {
                // Jika method throws, tetap laporkan sebagai error
                $violations[] = [
                    'rule'    => 3,
                    'column'  => $key,
                    'message' => "configColumns key '{$key}' throws: {$e->getMessage()}",
                ];
            }
        }

        $tpl = method_exists($modelClass, 'templateLink') ? $modelClass::templateLink() : null;
        if (is_string($tpl) && $tpl !== '') {
            $tplV = static::checkTemplateLinkResolvable($tpl, $columns, $dbColumns);
            foreach ($tplV as $v) {
                $violations[] = $v;
            }
        }

        foreach ($columns as $col) {
            if (isset($col['related']) && is_string($col['related'])) {
                $related = $col['related'];
                if (class_exists($related) && is_subclass_of($related, EloquentModel::class)) {
                    if (! method_exists($related, 'getColumns') && ! in_array(LinkModel::class, class_uses_recursive($related), true)) {
                        $violations[] = [
                            'rule'    => 5,
                            'column'  => $col['name'] ?? '(unknown)',
                            'message' => "Relasi '{$col['name']}' related class '{$related}' tidak punya getColumns (tidak memakai LinkModel).",
                        ];
                    }
                }
            }
        }

        return $violations;
    }

    private static function checkAppendDependsOn(array $col, array $dbColumns, array $configColumns): ?array {
        $name   = $col['name'] ?? '(unknown)';
        $isFrc  = isset($col['forceAppend']) && $col['forceAppend'];
        $isDb   = in_array($name, $dbColumns, true);
        $dep    = $col['dependsOn'] ?? null;
        $hasDep = is_array($dep) && $dep !== [];

        if ($isFrc || $isDb) {
            return null;
        }

        if (! $hasDep) {
            return [
                'rule'    => 1,
                'column'  => $name,
                'message' => "Append '{$name}' (type=attribute, bukan kolom DB, bukan forceAppend) tidak punya dependsOn non-kosong.",
            ];
        }

        return null;
    }

    private static function checkDependsOnResolvable(string $modelClass, string $dep, array $columns, array $dbColumns, array $col): ?array {
        $colName = $col['name'] ?? '(unknown)';

        if (! str_contains($dep, '.')) {
            if (in_array($dep, $dbColumns, true)) {
                return null;
            }

            // Lolos jika dep adalah relasi, accessor, atau join result yang dikenal
            foreach ($columns as $c) {
                $cName      = $c['name'] ?? null;
                $nameOfFunc = $c['nameOfFunction'] ?? null;
                if ($cName === $dep || $nameOfFunc === $dep || Str::snake($dep) === $cName || Str::camel((string) $cName) === $dep) {
                    return null;
                }
            }

            return [
                'rule'    => 2,
                'column'  => $colName,
                'message' => "dependsOn '{$dep}' di '{$colName}' bukan kolom DB yang ada.",
            ];
        }

        $segments = explode('.', $dep);
        $first    = $segments[0];

        $firstCol = null;
        foreach ($columns as $c) {
            if (($c['name'] ?? null) === $first || ($c['nameOfFunction'] ?? null) === $first || ($c['name'] ?? null) === Str::snake($first)) {
                $firstCol = $c;
                break;
            }
        }

        if ($firstCol === null) {
            return [
                'rule'    => 2,
                'column'  => $colName,
                'message' => "dependsOn '{$dep}' relasi pertama '{$first}' tidak ditemukan di columns.",
            ];
        }

        $relNameOfFunction = $firstCol['nameOfFunction'] ?? null;
        if (! (is_string($relNameOfFunction) && $relNameOfFunction !== '')) {
            return [
                'rule'    => 2,
                'column'  => $colName,
                'message' => "dependsOn '{$dep}' segmen pertama '{$first}' bukan relasi.",
            ];
        }

        // Asumsi relasi ini valid dan akan memiliki getColumns jika memang LinkModel
        // Validasi Rule 5 sudah memastikan related class punya getColumns.
        return null;
    }

    private static function checkRelationValid(string $modelClass, array $col, EloquentModel $instance): ?array {
        $fn = $col['nameOfFunction'] ?? null;
        $nm = $col['name'] ?? '(unknown)';

        if (! is_string($fn) || $fn === '') {
            return null;
        }

        if (! method_exists($instance, $fn)) {
            return [
                'rule'    => 3,
                'column'  => $nm,
                'message' => "Relasi '{$nm}' nameOfFunction '{$fn}' tidak ada di model.",
            ];
        }

        try {
            $rel = $instance->$fn();
            if (! $rel instanceof Relation) {
                return [
                    'rule'    => 3,
                    'column'  => $nm,
                    'message' => "Relasi '{$nm}' nameOfFunction '{$fn}' bukan Relation instance.",
                ];
            }
        } catch (\Throwable $e) {
            return [
                'rule'    => 3,
                'column'  => $nm,
                'message' => "Relasi '{$nm}' nameOfFunction '{$fn}' throws: {$e->getMessage()}",
            ];
        }

        return null;
    }

    /**
     * @return array<int, array{rule:int, column?:string, message:string}>
     */
    private static function checkTemplateLinkResolvable(string $tpl, array $columns, array $dbColumns): array {
        $violations = [];

        if (! preg_match_all('/:((\w[\w]+\{:[\w.]+\})|(\w[\w.]+))/', $tpl, $matches)) {
            return $violations;
        }

        foreach ($matches[1] as $raw) {
            $raw  = preg_replace('/\{:.*?\}/', '', $raw);
            $head = str_contains($raw, '.') ? explode('.', $raw)[0] : $raw;

            if ($head === '') {
                continue;
            }

            $isDb   = in_array($head, $dbColumns, true);
            $isRel  = false;
            $isAcc  = false;
            $isJoin = false;

            foreach ($columns as $c) {
                $colName    = $c['name'] ?? null;
                $nameOfFunc = $c['nameOfFunction'] ?? null;
                $isJoin     = ($c['isJoinResult'] ?? false);

                if ($colName === $head || $colName === Str::snake($head) || Str::camel($colName) === $head || $nameOfFunc === $head) {
                    $isRel = isset($c['nameOfFunction']);
                    $isAcc = ($c['type'] ?? null) === 'attribute' && ! $isRel;
                    break;
                }
            }

            if (! $isDb && ! $isRel && ! $isAcc && ! $isJoin) {
                $violations[] = [
                    'rule'    => 4,
                    'column'  => $head,
                    'message' => "templateLink token ':{$head}' tidak resolvable (bukan kolom DB, relasi, accessor, atau JoinResult).",
                ];
            }
        }

        return $violations;
    }

    /**
     * Baca property protected/private lewat Reflection — $instance->prop tidak
     * bisa dipakai di sini karena class ini bukan bagian hierarki Model.
     */
    private static function readProtectedProperty(EloquentModel $instance, string $property): mixed {
        $reflection = new ReflectionClass($instance);
        if (! $reflection->hasProperty($property)) {
            return null;
        }

        $prop = $reflection->getProperty($property);
        $prop->setAccessible(true);

        return $prop->getValue($instance);
    }
}
