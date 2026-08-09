<?php

namespace App\Events\Sales\Order;

use App\Models\Model;
use Illuminate\Foundation\Events\Dispatchable;

class DocumentDeliveryStatusRecalculationRequested {
    use Dispatchable;

    public function __construct(
        public readonly Model $document,  // SalesOrder | InternalOrder
    ) {}
}
