<?php

namespace App\Services\Asset\Depreciation\Methods;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\DepreciationMethodContract;
use Carbon\Carbon;

class DoubleDecliningBalanceDepreciationMethod implements DepreciationMethodContract {
    public function calculate(Asset $asset): array {
        $depreciableBase = (float) $asset->total_asset_cost - (float) $asset->expected_value_after_useful_life;
        $rate            = 2 / $asset->total_number_of_depreciations;
        $accumulated     = (float) ($asset->opening_accumulated_depreciation ?? 0);
        $date            = Carbon::parse($asset->depreciation_start_date ?? $asset->available_for_use_date);
        $rows            = [];

        for ($i = 0; $i < $asset->total_number_of_depreciations; $i++) {
            $date          = $date->copy()->addMonths($asset->frequency_of_depreciation);
            $bookValueOpen = (float) $asset->total_asset_cost - $accumulated;
            $amount        = round($bookValueOpen * $rate, 2);
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
