<?php

namespace App\Listeners\Purchase\Invoice;

use App\Events\Purchase\Invoice\PurchaseInvoiceReturnStatusChanged;

class UpdatePurchaseInvoiceReturnStatus {
    public function handle(PurchaseInvoiceReturnStatusChanged $event): void {
        $event->returnAgainst->update(['status' => $event->status]);
    }
}
