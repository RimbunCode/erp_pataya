<?php

namespace App\Listeners\Asset\Rental;

use App\Events\Asset\AssetRentalDeliveryApproved;

class SetAssetInRent {
    public function handle(AssetRentalDeliveryApproved $event): void {
        $line = $event->line;
        if ($line->processed_at) {
            return;
        }

        $line->asset->addRentedQuantity($line->quantity);
        $line->update(['processed_at' => now()]);
    }
}
