<?php

namespace App\Services\Core;

use App\Services\Core\DataTable\Template\ExpressionSql;
use App\Services\Core\DataTable\Template\TemplateDependencyExtractor;
use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ReflectionClass;

class DataTableConfigValidator {
    /** Formatter placeholder template yang dikenal (`:field|fmt`). */
    public const KNOWN_FORMATTERS = ['date', 'datetime', 'relative', 'number', 'currency', 'percent', 'trans'];

    /** Warna `badgeColors` yang valid (palet tetap + varian Badge existing). */
    public const BADGE_COLORS = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'default', 'secondary', 'destructive', 'outline'];

    /** Kedalaman maksimum penelusuran relasi bersarang pada path template. */
    private const MAX_TEMPLATE_DEPTH = 5;

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
            if ($computedCol !== null && (($computedCol['forceAppend'] ?? false) || ($computedCol['isJoinResult'] ?? false) || ($computedCol['virtual'] ?? false))) {
                continue; // Rule 4: forceAppend/isJoinResult/virtual (template/expression) — valid
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

        array_push($violations, ...static::validateTemplateColumns($modelClass, $instance, $columns, $dbColumns));

        return $violations;
    }

    /**
     * Rule 6-12 (spec datatable-semantic-templates): template kolom & `mobileTemplate()`
     * resolvable, formatter dikenal, `isLink` + `<nav-link>`, `expression` (tipe & SQL valid),
     * `progress` tanpa sumber nilai, `badgeColors` valid.
     *
     *  6  path template tidak resolvable / merujuk kolom `$hidden` atau `ignore`
     *  7  formatter tidak dikenal
     *  8  `isLink: true` dan template memuat `<nav-link>` (tautan bersarang)
     *  9  `expression` pada type selain number/currency/progress
     *  10 SQL `expression` gagal dijalankan (`select (<sql>) ... limit 0`)
     *  11 `type: 'progress'` tanpa `expression` dan tanpa `dependsOn` tunggal
     *  12 `badgeColors` bukan peta nilai => warna palet
     *
     * @param  array<int, array<string, mixed>>  $columns  hasil computeColumnsFlat(true)
     * @param  list<string>  $dbColumns
     * @return array<int, array{rule:int, column?:string, message:string}>
     */
    private static function validateTemplateColumns(string $modelClass, EloquentModel $instance, array $columns, array $dbColumns): array {
        $violations = [];
        $contexts   = [];

        foreach ($columns as $col) {
            $name     = (string) ($col['name'] ?? '(unknown)');
            $template = is_string($col['template'] ?? null) ? $col['template'] : '';

            if ($template !== '') {
                // Template kolom relasi dievaluasi terhadap model ANAK, kolom lain terhadap model ini.
                $owner = isset($col['nameOfFunction'], $col['related']) && is_string($col['related']) ? $col['related'] : $modelClass;
                foreach (static::checkTemplate($template, $name, $owner, $contexts) as $v) {
                    $violations[] = $v;
                }

                if (($col['isLink'] ?? false) && stripos($template, '<nav-link') !== false) {
                    $violations[] = [
                        'rule'    => 8,
                        'column'  => $name,
                        'message' => "Kolom '{$name}' isLink: true dan template-nya memuat <nav-link> (tautan bersarang tidak valid).",
                    ];
                }
            }

            if (array_key_exists('expression', $col)) {
                foreach (static::checkExpression($col, $name, $instance) as $v) {
                    $violations[] = $v;
                }
            }

            if (($col['type'] ?? null) === 'progress') {
                $hasExpression = is_string($col['expression'] ?? null) && trim($col['expression']) !== '';
                $deps          = is_array($col['dependsOn'] ?? null) ? $col['dependsOn'] : [];
                if (! $hasExpression && count($deps) !== 1) {
                    $violations[] = [
                        'rule'    => 11,
                        'column'  => $name,
                        'message' => "Kolom progress '{$name}' wajib punya 'expression' atau tepat satu 'dependsOn' sebagai sumber nilai.",
                    ];
                }
            }

            if (array_key_exists('badgeColors', $col)) {
                $invalid = ! is_array($col['badgeColors']);
                if (! $invalid) {
                    foreach ($col['badgeColors'] as $color) {
                        if (! is_string($color) || ! in_array($color, static::BADGE_COLORS, true)) {
                            $invalid = true;

                            break;
                        }
                    }
                }
                if ($invalid) {
                    $violations[] = [
                        'rule'    => 12,
                        'column'  => $name,
                        'message' => "badgeColors di '{$name}' harus berupa peta nilai => warna dari palet: " . implode(', ', static::BADGE_COLORS) . '.',
                    ];
                }
            }
        }

        if (method_exists($modelClass, 'mobileTemplate')) {
            try {
                $mobile = $modelClass::mobileTemplate();
            } catch (\Throwable $e) {
                $mobile       = null;
                $violations[] = [
                    'rule'    => 6,
                    'column'  => '(mobileTemplate)',
                    'message' => "mobileTemplate() throws: {$e->getMessage()}",
                ];
            }
            if (is_string($mobile) && $mobile !== '') {
                foreach (static::checkTemplate($mobile, '(mobileTemplate)', $modelClass, $contexts) as $v) {
                    $violations[] = $v;
                }
            }
        }

        return $violations;
    }

    /**
     * Rule 6 (path resolvable, tidak hidden/ignore) dan 7 (formatter dikenal) untuk satu template.
     *
     * @param  array<string, array<string, mixed>>  $contexts  memo konteks model (kolom flat, kolom DB, hidden, config)
     * @return array<int, array{rule:int, column?:string, message:string}>
     */
    private static function checkTemplate(string $template, string $colName, string $ownerClass, array &$contexts): array {
        $violations = [];

        foreach (TemplateDependencyExtractor::extract($template) as $path) {
            $error = static::resolveTemplatePath($ownerClass, $path, 0, $contexts);
            if ($error !== null) {
                $violations[] = [
                    'rule'    => 6,
                    'column'  => $colName,
                    'message' => "Template '{$colName}': path ':{$path}' {$error}.",
                ];
            }
        }

        foreach (TemplateDependencyExtractor::formatters($template) as $formatter) {
            if (! in_array($formatter, static::KNOWN_FORMATTERS, true)) {
                $violations[] = [
                    'rule'    => 7,
                    'column'  => $colName,
                    'message' => "Template '{$colName}': formatter '|{$formatter}' tidak dikenal (" . implode(', ', static::KNOWN_FORMATTERS) . ').',
                ];
            }
        }

        return $violations;
    }

    /**
     * Telusuri path template (dot-notation, rekursif per relasi). Mengembalikan pesan
     * alasan bila gagal, `null` bila resolvable.
     *
     * @param  array<string, array<string, mixed>>  $contexts
     */
    private static function resolveTemplatePath(string $class, string $path, int $depth, array &$contexts): ?string {
        $context = static::modelContext($class, $contexts);
        if ($context === null) {
            return null; // model tanpa LinkModel/skema: tak bisa dinilai, jangan false-positive.
        }

        $segments = explode('.', $path);
        $head     = array_shift($segments);

        if (in_array($head, $context['hidden'], true)) {
            return "merujuk kolom '{$head}' yang disembunyikan model ({$class}::\$hidden)";
        }
        $config = $context['config'][$head] ?? $context['config'][Str::snake($head)] ?? null;
        if (is_array($config) && ! empty($config['ignore'])) {
            return "merujuk kolom '{$head}' yang di-ignore di configColumns ({$class})";
        }

        $found = null;
        foreach ($context['columns'] as $c) {
            $cName = $c['name'] ?? null;
            if ($cName === $head || ($c['nameOfFunction'] ?? null) === $head || $cName === Str::snake($head) || (is_string($cName) && Str::camel($cName) === $head)) {
                $found = $c;

                break;
            }
        }

        if ($segments === []) {
            return $found !== null || in_array($head, $context['db'], true)
                ? null
                : "tidak dikenal di {$class} (bukan kolom DB, accessor, kolom virtual, maupun relasi)";
        }

        if ($found === null || ! isset($found['nameOfFunction'], $found['related']) || ! is_string($found['related'])) {
            return "segmen '{$head}' bukan relasi di {$class}";
        }
        if ($depth + 1 >= self::MAX_TEMPLATE_DEPTH) {
            return null;
        }

        return static::resolveTemplatePath($found['related'], implode('.', $segments), $depth + 1, $contexts);
    }

    /**
     * Konteks validasi satu model: kolom flat, kolom DB, `$hidden`, dan configColumns
     * (ter-merge). `null` bila kelas bukan LinkModel.
     *
     * @param  array<string, array<string, mixed>>  $contexts
     * @return array{columns: array<int, array<string, mixed>>, db: list<string>, hidden: list<string>, config: array<string, mixed>}|null
     */
    private static function modelContext(string $class, array &$contexts): ?array {
        if (array_key_exists($class, $contexts)) {
            return $contexts[$class];
        }

        $contexts[$class] = null;
        if (! class_exists($class) || ! is_subclass_of($class, EloquentModel::class) || ! method_exists($class, 'computeColumnsFlat')) {
            return null;
        }

        try {
            $instance = new $class;
            $db       = Schema::getColumnListing($instance->getTable());
            $config   = $class::mergeConfigColumns(
                static::readProtectedProperty($instance, 'defaultConfigColumns') ?? [],
                static::readProtectedProperty($instance, 'configColumns') ?? [],
            );

            return $contexts[$class] = [
                'columns' => $class::computeColumnsFlat(true),
                'db'      => $db,
                'hidden'  => $instance->getHidden(),
                'config'  => $config,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Rule 9 (tipe didukung) dan 10 (SQL valid: dijalankan dengan LIMIT 0).
     *
     * @param  array<string, mixed>  $col
     * @return array<int, array{rule:int, column?:string, message:string}>
     */
    private static function checkExpression(array $col, string $name, EloquentModel $instance): array {
        $violations = [];
        $expression = $col['expression'] ?? null;
        $type       = $col['type'] ?? null;

        if (! in_array($type, ExpressionSql::EXPRESSION_TYPES, true)) {
            $violations[] = [
                'rule'    => 9,
                'column'  => $name,
                'message' => "expression di '{$name}' hanya boleh untuk type " . implode('/', ExpressionSql::EXPRESSION_TYPES) . ' (type saat ini: ' . (is_string($type) ? $type : 'tidak ada') . ').',
            ];
        }

        if (! is_string($expression) || trim($expression) === '') {
            $violations[] = [
                'rule'    => 10,
                'column'  => $name,
                'message' => "expression di '{$name}' harus berupa string SQL tak kosong.",
            ];

            return $violations;
        }

        $sql = ExpressionSql::forColumn($col) ?? "({$expression})";

        try {
            $connection = $instance->getConnection();
            $table      = $connection->getQueryGrammar()->wrapTable($instance->getTable());
            $connection->select("select {$sql} as v from {$table} limit 0");
        } catch (\Throwable $e) {
            $violations[] = [
                'rule'    => 10,
                'column'  => $name,
                'message' => "expression di '{$name}' gagal dijalankan: {$e->getMessage()}",
            ];
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
