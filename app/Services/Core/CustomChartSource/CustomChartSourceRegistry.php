<?php

namespace App\Services\Core\CustomChartSource;

use App\Contracts\Core\CustomChartSourceContract;
use RuntimeException;

/**
 * Daftar TERTUTUP source `custom` NumberCard/Chart — key => FQCN class
 * yang implement `CustomChartSourceContract`, didaftarkan eksplisit di
 * kode (BUKAN string bebas dari database/input user). Belum ada
 * implementasi konkret di-ship (belum ada use case nyata) — infrastruktur
 * ini siap didaftari fitur lain ke depan tanpa ubah NumberCardService/
 * ChartService.
 */
class CustomChartSourceRegistry {
    /** @var array<string,class-string<CustomChartSourceContract>> */
    private array $sources = [];

    public function isRegistered(string $key): bool {
        return isset($this->sources[$key]);
    }

    /** @param  array<string,mixed>  $filters */
    public function resolve(?string $key, array $filters): array {
        if ($key === null || ! $this->isRegistered($key)) {
            throw new RuntimeException("Custom chart source [{$key}] tidak terdaftar.");
        }

        /** @var CustomChartSourceContract $source */
        $source = app($this->sources[$key]);

        return $source->getValue($filters);
    }
}
