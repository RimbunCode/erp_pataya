<?php

namespace App\Listeners\Purchase\Order;

use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Services\Purchase\PurchaseOrderService;

class RecalculatePurchaseOrderReceiveStatus {
    public function handle(PurchaseOrderReceiveStatusRecalculationRequested $event): void {
        app(PurchaseOrderService::class)->updatePurchaseOrderReceiveStatus($event->purchaseOrder);
    }
}
