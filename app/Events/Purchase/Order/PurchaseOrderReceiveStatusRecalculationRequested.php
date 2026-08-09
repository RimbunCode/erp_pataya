<?php

namespace App\Events\Purchase\Order;

use App\Models\Purchase\PurchaseOrder;
use Illuminate\Foundation\Events\Dispatchable;

class PurchaseOrderReceiveStatusRecalculationRequested {
    use Dispatchable;

    public function __construct(
        public readonly PurchaseOrder $purchaseOrder,
    ) {}
}
