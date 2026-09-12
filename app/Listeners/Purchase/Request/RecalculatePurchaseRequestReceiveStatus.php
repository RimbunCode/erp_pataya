<?php

namespace App\Listeners\Purchase\Request;

use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Services\Purchase\PurchaseRequestService;

class RecalculatePurchaseRequestReceiveStatus {
    public function handle(PurchaseRequestReceiveStatusRecalculationRequested $event): void {
        app(PurchaseRequestService::class)->updatePurchaseRequestReceiveStatus($event->purchaseOrder);
    }
}
