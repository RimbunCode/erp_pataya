<?php

namespace App\Listeners\Asset\Rental;

use App\Events\Asset\AssetRentalReturnApproved;

class ReturnAssetFromRent {
    public function handle(AssetRentalReturnApproved $event): void {
        $line = $event->line;
        if ($line->processed_at) {
            return;
        }

        $line->asset->removeRentedQuantity($line->quantity);
        $line->update(['processed_at' => now()]);
    }
}
