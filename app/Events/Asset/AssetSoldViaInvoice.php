<?php

namespace App\Events\Asset;

use App\Models\Finances\SalesInvoiceItemAsset;
use Illuminate\Foundation\Events\Dispatchable;

class AssetSoldViaInvoice {
    use Dispatchable;

    public function __construct(
        public readonly SalesInvoiceItemAsset $line,
    ) {}
}
