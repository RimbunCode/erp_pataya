<?php

namespace App\Services\Asset\Depreciation\Methods;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\DepreciationMethodContract;
use Carbon\Carbon;

class ManualDepreciationMethod implements DepreciationMethodContract {
    public function calculate(Asset $asset): array {
        $accumulated = (float) ($asset->opening_accumulated_depreciation ?? 0);
        $date        = Carbon::parse($asset->depreciation_start_date ?? $asset->available_for_use_date);
        $rows        = [];

        for ($i = 0; $i < $asset->total_number_of_depreciations; $i++) {
            $date = $date->copy()->addMonths($asset->frequency_of_depreciation);

            $rows[] = [
                'schedule_date'                   => $date,
                'depreciation_amount'             => 0.0,
                'accumulated_depreciation_amount' => $accumulated,
            ];
        }

        return $rows;
    }
}
