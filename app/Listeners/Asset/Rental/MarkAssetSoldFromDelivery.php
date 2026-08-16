<?php

namespace App\Listeners\Asset\Rental;

use App\Events\Asset\AssetSoldViaDelivery;

class MarkAssetSoldFromDelivery {
    public function handle(AssetSoldViaDelivery $event): void {
        $line = $event->line;
        if ($line->processed_at) {
            return;
        }

        $line->asset->addSoldQuantity($line->quantity);
        $line->update(['processed_at' => now()]);
    }
}
