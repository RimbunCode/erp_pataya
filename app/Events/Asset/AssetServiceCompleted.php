<?php

namespace App\Events\Asset;

use App\Models\Asset\AssetService;
use Illuminate\Foundation\Events\Dispatchable;

class AssetServiceCompleted {
    use Dispatchable;

    public function __construct(
        public readonly AssetService $assetService,
    ) {}
}
