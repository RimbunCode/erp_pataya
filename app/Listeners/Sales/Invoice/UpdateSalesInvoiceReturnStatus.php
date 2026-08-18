<?php

namespace App\Listeners\Sales\Invoice;

use App\Events\Sales\Invoice\SalesInvoiceReturnStatusChanged;

class UpdateSalesInvoiceReturnStatus {
    public function handle(SalesInvoiceReturnStatusChanged $event): void {
        $event->returnAgainst->update(['status' => $event->status]);
    }
}
