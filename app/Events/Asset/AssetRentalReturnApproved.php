<?php

namespace App\Events\Asset;

use App\Models\Inventory\DeliveryNoteItemAsset;
use Illuminate\Foundation\Events\Dispatchable;

class AssetRentalReturnApproved {
    use Dispatchable;

    public function __construct(
        public readonly DeliveryNoteItemAsset $line,
    ) {}
}
