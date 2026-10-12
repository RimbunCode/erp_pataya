<?php

namespace App\Events\Asset;

use App\Models\Inventory\DeliveryNoteItem;
use Illuminate\Foundation\Events\Dispatchable;

class AssetSoldViaDelivery {
    use Dispatchable;

    public function __construct(
        public readonly DeliveryNoteItem $line,
    ) {}
}
