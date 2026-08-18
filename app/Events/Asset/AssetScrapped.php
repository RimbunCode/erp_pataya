<?php

namespace App\Events\Asset;

use App\Models\Asset\Asset;
use Illuminate\Foundation\Events\Dispatchable;

class AssetScrapped {
    use Dispatchable;

    public function __construct(
        public readonly Asset $asset,
        public readonly float $writeOffAmount,
        public readonly \DateTimeInterface $transactionDate,
    ) {}
}
