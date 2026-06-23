<?php

namespace App\Services\Core;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

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

        $configColumns = $modelClass::mergeConfigColumns(
            $instance->defaultConfigColumns ?? [],
            $instance->configColumns ?? [],
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

        foreach ($configColumns as $key => $config) {
            $key = is_string($key) ? $key : $config;
            if (! method_exists($instance, $key)) {
                continue;
            }
            try {
                $rel = $instance->$key();
                if (! $rel instanceof Relation) {
                    continue; // Bukan relasi (mis. Attribute), skip validasi Rule 3
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
            if (! in_array($dep, $dbColumns, true)) {
                return [
                    'rule'    => 2,
                    'column'  => $colName,
                    'message' => "dependsOn '{$dep}' di '{$colName}' bukan kolom DB yang ada.",
                ];
            }

            return null;
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
}
