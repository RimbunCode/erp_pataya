<?php

namespace App\Listeners\Purchase\Order;

use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Services\Purchase\PurchaseOrderService;

class RecalculatePurchaseOrderBillStatus {
    public function handle(PurchaseOrderBillStatusRecalculationRequested $event): void {
        app(PurchaseOrderService::class)->updatePurchaseOrderBillStatus($event->purchaseOrder, $event->returnAgainst);
    }
}
