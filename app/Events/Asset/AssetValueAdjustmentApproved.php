<?php

namespace App\Events\Asset;

use App\Models\Asset\AssetValueAdjustment;
use Illuminate\Foundation\Events\Dispatchable;

class AssetValueAdjustmentApproved {
    use Dispatchable;

    public function __construct(
        public readonly AssetValueAdjustment $adjustment,
        public readonly \DateTimeInterface $transactionDate,
    ) {}
}
