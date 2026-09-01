<?php

namespace App\Contracts\Core;

/**
 * Kontrak source `custom` NumberCard/Chart — satu-satunya jalan resmi
 * source `custom` boleh mengembalikan data. Implementasinya HARUS
 * terdaftar eksplisit di `CustomChartSourceRegistry`; sengaja TIDAK ada
 * mekanisme pemanggilan method dari string bebas (beda dari ERPNext yang
 * whitelist method-path terbuka) — permukaan serang lebih kecil.
 */
interface CustomChartSourceContract {
    /**
     * Bentuk hasil bergantung konsumen: NumberCardService baca `value`,
     * ChartService baca `labels`/`datasets` (sama shape hasil ChartService
     * lainnya) — registry & kontrak ini tidak memaksakan salah satunya.
     *
     * @param  array<string,mixed>  $filters  filter tree (FilterEvaluator)
     * @return array<string,mixed>
     */
    public function getValue(array $filters): array;
}
