<?php

namespace App\Listeners\Asset\Rental;

use App\Enums\AssetMovementPurpose;
use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Services\Asset\AssetMovementService;

class SetAssetInRent {
    public function __construct(private AssetMovementService $assetMovementService) {}

    public function handle(AssetRentalDeliveryApproved $event): void {
        $line = $event->line;
        if ($line->processed_at) {
            return;
        }

        $line->asset->addRentedQuantity($line->quantity);
        $this->assetMovementService->createFromRentalSale($line, AssetMovementPurpose::RENT_OUT);
        $line->update(['processed_at' => now()]);
    }
}
