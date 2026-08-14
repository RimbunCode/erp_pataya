<?php

namespace App\Services\Asset\Depreciation;

use App\Models\Asset\Asset;
use Carbon\Carbon;

interface DepreciationMethodContract {
    /**
     * @return array<int, array{schedule_date: Carbon, depreciation_amount: float, accumulated_depreciation_amount: float}>
     */
    public function calculate(Asset $asset): array;
}
