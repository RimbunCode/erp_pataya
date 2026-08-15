<?php

namespace App\Listeners\Asset\Maintenance;

use App\Events\Asset\AssetServiceCompleted;

class ReactivateAssetFromService {
    public function handle(AssetServiceCompleted $event): void {
        $asset = $event->assetService->resolvedAsset();

        $asset?->reactivate();
    }
}
