<?php

namespace App\Listeners\Asset\Rental;

use App\Enums\AssetMovementPurpose;
use App\Events\Asset\AssetRentalReturnApproved;
use App\Services\Asset\AssetMovementService;

class ReturnAssetFromRent {
    public function __construct(private AssetMovementService $assetMovementService) {}

    public function handle(AssetRentalReturnApproved $event): void {
        $line = $event->line;
        if ($line->processed_at) {
            return;
        }

        $line->asset->removeRentedQuantity($line->quantity);
        $this->assetMovementService->createFromRentalSale($line, AssetMovementPurpose::RETURN_FROM_RENT);
        $line->update(['processed_at' => now()]);
    }
}
