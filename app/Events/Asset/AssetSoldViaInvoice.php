<?php

namespace App\Events\Asset;

use App\Models\Finances\SalesInvoiceItem;
use Illuminate\Foundation\Events\Dispatchable;

class AssetSoldViaInvoice {
    use Dispatchable;

    public function __construct(
        public readonly SalesInvoiceItem $line,
    ) {}
}
