<?php

namespace App\Services\Asset\Depreciation\Methods;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\AppliesDailyProrata;
use App\Services\Asset\Depreciation\DepreciationMethodContract;
use Carbon\Carbon;

class StraightLineDepreciationMethod implements DepreciationMethodContract {
    use AppliesDailyProrata;

    public function calculate(Asset $asset): array {
        $depreciableBase = (float) $asset->total_asset_cost - (float) $asset->expected_value_after_useful_life;
        $perPeriod       = round($depreciableBase / $asset->total_number_of_depreciations, 2);
        $accumulated     = (float) ($asset->opening_accumulated_depreciation ?? 0);
        $date            = Carbon::parse($asset->depreciation_start_date ?? $asset->available_for_use_date);
        $rows            = [];

        for ($i = 0; $i < $asset->total_number_of_depreciations; $i++) {
            $periodStart = $date;
            $date        = $date->copy()->addMonths($asset->frequency_of_depreciation);
            $amount      = $this->applyDailyProrataToFirstPeriod($asset, $i, $periodStart, $date, $perPeriod);
            $accumulated += $amount;

            if ($accumulated > $depreciableBase) {
                $amount -= ($accumulated - $depreciableBase);
                $accumulated = $depreciableBase;
            }

            $rows[] = [
                'schedule_date'                   => $date,
                'depreciation_amount'             => $amount,
                'accumulated_depreciation_amount' => $accumulated,
            ];
        }

        return $rows;
    }
}
