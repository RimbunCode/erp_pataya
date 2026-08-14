<?php

namespace App\Events\Asset;

use App\Models\Asset\AssetMovement;
use Illuminate\Foundation\Events\Dispatchable;

class AssetMovementApproved {
    use Dispatchable;

    public function __construct(
        public readonly AssetMovement $movement,
    ) {}
}
