<?php

namespace App\Events\Purchase\Invoice;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

class PurchaseOrderItemBillingChanged {
    use Dispatchable;

    public function __construct(
        public readonly Model $purchaseOrderItem,
        public readonly float $quantity,
        public readonly string $operator,           // 'increment' | 'decrement'
        public readonly ?Model $returnAgainstItem = null,
    ) {}
}
