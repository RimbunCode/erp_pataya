<?php

namespace App\Events\Finances;

use App\Models\Model;
use Illuminate\Foundation\Events\Dispatchable;

class PaymentApplied {
    use Dispatchable;

    public function __construct(
        public readonly Model $paymentable,  // SalesInvoice | PurchaseInvoice
        public readonly float $newPaidAmount,
    ) {}
}
