<?php

namespace App\Events\Asset;

use App\Models\Inventory\Item;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FixedAssetItemApproved {
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Model $sourceDocument,
        public readonly Model $sourceItem,
        public readonly Item $item,
    ) {}
}
