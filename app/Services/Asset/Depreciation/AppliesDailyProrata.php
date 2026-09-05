<?php

namespace App\Services\Asset\Depreciation;

use App\Models\Asset\Asset;
use Carbon\Carbon;

/**
 * Requirement 2.6, spec asset-management-depreciation: kalau
 * Asset.daily_prorata_based true dan periode pertama tidak mulai tepat di
 * awal bulan, depreciation_amount periode pertama dihitung pro-rata harian —
 * porsi hari asset sebenarnya "dimiliki" (dari depreciation_start_date sampai
 * akhir periode kanonik) dibanding total hari periode kanonik itu (periode
 * bulan-penuh andai dimulai tanggal 1 di bulan yang sama). $scheduleDate
 * (kapan entry benar-benar posting) TIDAK berubah — hanya nominal-nya.
 */
trait AppliesDailyProrata {
    private function applyDailyProrataToFirstPeriod(Asset $asset, int $periodIndex, Carbon $periodStart, Carbon $scheduleDate, float $amount): float {
        if ($periodIndex !== 0 || ! $asset->daily_prorata_based || $periodStart->day === 1) {
            return $amount;
        }

        $canonicalStart = $periodStart->copy()->startOfMonth();
        $canonicalEnd   = $canonicalStart->copy()->addMonths($asset->frequency_of_depreciation);
        $totalDays      = $canonicalStart->diffInDays($canonicalEnd);
        $actualDays     = $periodStart->diffInDays($canonicalEnd);

        return $totalDays > 0 ? round($amount * $actualDays / $totalDays, 2) : $amount;
    }
}
