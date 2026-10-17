<?php

namespace App\Services\Core;

use App\Services\Core\DataTable\Template\TemplateDependencyExtractor;
use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class DataTableConfigCache {
    private static array $signatureCache = [];

    /**
     * Memo per-request hasil flat() per model. Satu request bisa meminta model yang
     * sama berkali-kali (mis. Branch/User dari beberapa kolom relasi); tanpa memo tiap
     * panggilan membaca store cache lagi (1 SELECT ke tabel `cache` pada driver database).
     *
     * @var array<string, array>
     */
    private static array $flatCache = [];

    /**
     * Memo per-request hasil meta() per model (lihat $flatCache).
     *
     * @var array<string, array{mobileTemplate: ?string, mobileDependsOn: list<string>}>
     */
    private static array $metaCache = [];

    /** Dipanggil test: static hidup selama seluruh proses PHPUnit. */
    public static function forgetMemo(): void {
        self::$flatCache = [];
        self::$metaCache = [];
    }

    public static function signatureFor(string $modelClass): string {
        if (isset(self::$signatureCache[$modelClass])) {
            return self::$signatureCache[$modelClass];
        }

        $reflection    = new \ReflectionClass($modelClass);
        $modelFile     = $reflection->getFileName();
        $linkModelFile = (new \ReflectionClass(LinkModel::class))->getFileName();

        // SchemaColumnCache (bukan Schema::getColumnListing() langsung) --
        // signatureFor() dipanggil tiap request; tanpa cache bersama,
        // Clockwork nunjukin tabel yang sama di-introspeksi ulang dari sini
        // DAN dari HasExampleData/DataTableColumnSelector di request yang sama.
        $schemaHash = md5(json_encode(SchemaColumnCache::columns((new $modelClass)->getTable())));

        return self::$signatureCache[$modelClass] = md5(json_encode([
            $schemaHash,
            $modelFile ? filemtime($modelFile) : 0,
            $linkModelFile ? filemtime($linkModelFile) : 0,
        ]));
    }

    public static function cacheKey(string $modelClass, string $signature): string {
        $prefix     = trim((string) config('datatable.config_cache_prefix', 'datatable_columns'));
        $connection = (string) DB::getDefaultConnection();
        $database   = (string) DB::getDatabaseName();

        return "{$prefix}:{$connection}:{$database}:{$modelClass}:{$signature}";
    }

    public static function flat(string $modelClass): array {
        if (! config('datatable.config_cache_enabled', true)) {
            return $modelClass::computeColumnsFlat(true);
        }

        if (isset(self::$flatCache[$modelClass])) {
            return self::$flatCache[$modelClass];
        }

        $signature = static::signatureFor($modelClass);
        $key       = static::cacheKey($modelClass, $signature);
        $ttl       = now()->addSeconds((int) config('datatable.config_cache_ttl_seconds', 86400));

        try {
            return self::$flatCache[$modelClass] = Cache::remember($key, $ttl, function () use ($modelClass) {
                return $modelClass::computeColumnsFlat(true);
            });
        } catch (\Throwable) {
            return $modelClass::computeColumnsFlat(true);
        }
    }

    /**
     * Metadata model di luar daftar kolom: template kartu mobile (`mobileTemplate()`
     * statis di model, opsional) beserta dependensi hasil ekstraksinya. Disimpan di
     * key terpisah `<cacheKey>:meta` supaya shape `flat()` tak berubah.
     *
     * @return array{mobileTemplate: ?string, mobileDependsOn: list<string>}
     */
    public static function meta(string $modelClass): array {
        if (! config('datatable.config_cache_enabled', true)) {
            return static::computeMeta($modelClass);
        }

        if (isset(self::$metaCache[$modelClass])) {
            return self::$metaCache[$modelClass];
        }

        $key = static::metaKey($modelClass);
        $ttl = now()->addSeconds((int) config('datatable.config_cache_ttl_seconds', 86400));

        try {
            return self::$metaCache[$modelClass] = Cache::remember($key, $ttl, function () use ($modelClass) {
                return static::computeMeta($modelClass);
            });
        } catch (\Throwable) {
            return static::computeMeta($modelClass);
        }
    }

    /**
     * Hitung meta tanpa cache: `mobileTemplate()` (bila didefinisikan, publik, statis,
     * tanpa parameter wajib) dan `mobileDependsOn` hasil ekstraksinya.
     *
     * @return array{mobileTemplate: ?string, mobileDependsOn: list<string>}
     */
    public static function computeMeta(string $modelClass): array {
        $template = null;

        if (method_exists($modelClass, 'mobileTemplate')) {
            try {
                $method = new \ReflectionMethod($modelClass, 'mobileTemplate');
                if ($method->isStatic() && $method->isPublic() && $method->getNumberOfRequiredParameters() === 0) {
                    $result   = $modelClass::mobileTemplate();
                    $template = is_string($result) && $result !== '' ? $result : null;
                }
            } catch (\Throwable) {
                $template = null;
            }
        }

        return [
            'mobileTemplate'  => $template,
            'mobileDependsOn' => TemplateDependencyExtractor::extract($template),
        ];
    }

    private static function metaKey(string $modelClass): string {
        return static::cacheKey($modelClass, static::signatureFor($modelClass)) . ':meta';
    }

    public static function forget(string $modelClass): void {
        $signature = static::signatureFor($modelClass);
        Cache::forget(static::cacheKey($modelClass, $signature));
        Cache::forget(static::cacheKey($modelClass, $signature) . ':meta');
        unset(self::$signatureCache[$modelClass], self::$flatCache[$modelClass], self::$metaCache[$modelClass]);
    }

    public static function warm(string $modelClass): array {
        $flat      = $modelClass::computeColumnsFlat(true);
        $signature = static::signatureFor($modelClass);
        $key       = static::cacheKey($modelClass, $signature);
        $ttl       = now()->addSeconds((int) config('datatable.config_cache_ttl_seconds', 86400));

        $meta = static::computeMeta($modelClass);

        Cache::put($key, $flat, $ttl);
        Cache::put($key . ':meta', $meta, $ttl);
        self::$flatCache[$modelClass] = $flat;
        self::$metaCache[$modelClass] = $meta;

        return $flat;
    }

    public static function discoverLinkModels(): array {
        $modelPath = app_path('Models');
        if (! is_dir($modelPath)) {
            return [];
        }

        $models = [];
        foreach (File::allFiles($modelPath) as $file) {
            $relative = str_replace([$modelPath . DIRECTORY_SEPARATOR, '.php'], '', $file->getPathname());
            $class    = 'App\\Models\\' . str_replace(DIRECTORY_SEPARATOR, '\\', $relative);

            if (! class_exists($class) || ! is_subclass_of($class, EloquentModel::class)) {
                continue;
            }

            $ref = new \ReflectionClass($class);
            if ($ref->isAbstract()) {
                continue;
            }

            if (! in_array(LinkModel::class, class_uses_recursive($class), true)) {
                continue;
            }

            // Skip models without a real DB table (base/abstract-like classes)
            try {
                $table = (new $class)->getTable();
                if (! Schema::hasTable($table)) {
                    continue;
                }
            } catch (\Throwable) {
                continue;
            }

            $models[] = $class;
        }

        return $models;
    }
}
