<?php

namespace App\Events\Purchase\Request;

use App\Models\Purchase\PurchaseOrder;
use Illuminate\Foundation\Events\Dispatchable;

class PurchaseRequestReceiveStatusRecalculationRequested {
    use Dispatchable;

    public function __construct(
        public readonly PurchaseOrder $purchaseOrder,
    ) {}
}
