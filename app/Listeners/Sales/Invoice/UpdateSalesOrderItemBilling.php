<?php

namespace App\Listeners\Sales\Invoice;

use App\Events\Sales\Invoice\SalesOrderItemBillingChanged;

class UpdateSalesOrderItemBilling {
    public function handle(SalesOrderItemBillingChanged $event): void {
        $event->salesOrderItem->{$event->operator}('billed_quantity', $event->quantity);
        $event->returnAgainstItem?->increment('returned_quantity', $event->quantity);
    }
}
