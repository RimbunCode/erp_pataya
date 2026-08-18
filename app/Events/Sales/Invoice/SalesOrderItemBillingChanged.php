<?php

namespace App\Events\Sales\Invoice;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

class SalesOrderItemBillingChanged {
    use Dispatchable;

    public function __construct(
        public readonly Model $salesOrderItem,
        public readonly float $quantity,
        public readonly string $operator,           // 'increment' | 'decrement'
        public readonly ?Model $returnAgainstItem = null,  // null jika bukan jalur retur
    ) {}
}
