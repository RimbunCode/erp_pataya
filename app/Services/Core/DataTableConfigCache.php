<?php

namespace App\Services\Core;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class DataTableConfigCache {
    private static array $signatureCache = [];

    public static function signatureFor(string $modelClass): string {
        if (isset(self::$signatureCache[$modelClass])) {
            return self::$signatureCache[$modelClass];
        }

        $reflection    = new \ReflectionClass($modelClass);
        $modelFile     = $reflection->getFileName();
        $linkModelFile = (new \ReflectionClass(LinkModel::class))->getFileName();

        $schemaHash = md5(json_encode(Schema::getColumnListing((new $modelClass)->getTable())));

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

        $signature = static::signatureFor($modelClass);
        $key       = static::cacheKey($modelClass, $signature);
        $ttl       = now()->addSeconds((int) config('datatable.config_cache_ttl_seconds', 86400));

        try {
            return Cache::remember($key, $ttl, function () use ($modelClass) {
                return $modelClass::computeColumnsFlat(true);
            });
        } catch (\Throwable) {
            return $modelClass::computeColumnsFlat(true);
        }
    }

    public static function forget(string $modelClass): void {
        $signature = static::signatureFor($modelClass);
        Cache::forget(static::cacheKey($modelClass, $signature));
        unset(self::$signatureCache[$modelClass]);
    }

    public static function warm(string $modelClass): array {
        $flat      = $modelClass::computeColumnsFlat(true);
        $signature = static::signatureFor($modelClass);
        $key       = static::cacheKey($modelClass, $signature);
        $ttl       = now()->addSeconds((int) config('datatable.config_cache_ttl_seconds', 86400));

        Cache::put($key, $flat, $ttl);

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
