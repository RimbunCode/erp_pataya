<?php

namespace App\Events\Purchase\Invoice;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

class PurchaseInvoiceReturnStatusChanged {
    use Dispatchable;

    public function __construct(
        public readonly Model $returnAgainst,
        public readonly mixed $status,
    ) {}
}
