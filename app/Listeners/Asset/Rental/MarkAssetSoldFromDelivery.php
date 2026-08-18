<?php

namespace App\Listeners\Asset\Rental;

use App\Enums\AssetMovementPurpose;
use App\Events\Asset\AssetSoldViaDelivery;
use App\Services\Asset\AssetMovementService;

class MarkAssetSoldFromDelivery {
    public function __construct(private AssetMovementService $assetMovementService) {}

    public function handle(AssetSoldViaDelivery $event): void {
        $line = $event->line;
        if ($line->processed_at) {
            return;
        }

        $line->asset->addSoldQuantity($line->quantity);
        $this->assetMovementService->createFromRentalSale($line, AssetMovementPurpose::SELL);
        $line->update(['processed_at' => now()]);
    }
}
