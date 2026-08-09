<?php

namespace App\Events\Sales\Invoice;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

class SalesInvoiceReturnStatusChanged {
    use Dispatchable;

    public function __construct(
        public readonly Model $returnAgainst,
        public readonly mixed $status,
    ) {}
}
