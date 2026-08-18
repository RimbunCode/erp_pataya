<?php

namespace App\Events\Asset;

use App\Models\Asset\AssetDepreciationSchedule;
use Illuminate\Foundation\Events\Dispatchable;

class AssetDepreciationDue {
    use Dispatchable;

    public function __construct(
        public readonly AssetDepreciationSchedule $schedule,
        public readonly \DateTimeInterface $transactionDate,
    ) {}
}
