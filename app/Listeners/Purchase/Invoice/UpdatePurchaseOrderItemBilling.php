<?php

namespace App\Listeners\Purchase\Invoice;

use App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged;

class UpdatePurchaseOrderItemBilling {
    public function handle(PurchaseOrderItemBillingChanged $event): void {
        $event->purchaseOrderItem->{$event->operator}('billed_quantity', $event->quantity);
        $event->returnAgainstItem?->increment('returned_quantity', $event->quantity);
    }
}
