<?php

namespace App\Events\Inventory;

use App\Models\Model;
use Illuminate\Foundation\Events\Dispatchable;

class StockReservationChanged {
    use Dispatchable;

    /**
     * @param  string  $operator  'increment' | 'decrement'
     * @param  string  $type  'reservations' | 'incomings'
     * @param  list<array{itemVariantId: string, warehouseId: string, quantity: float}>  $items
     */
    public function __construct(
        public readonly Model $document,
        public readonly string $operator,
        public readonly string $type,
        public readonly array $items,
    ) {}
}
