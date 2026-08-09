<?php

namespace App\Listeners\Sales\Order;

use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Services\Sales\InternalOrderService;
use App\Services\Sales\SalesOrderService;

class RecalculateDocumentDeliveryStatus {
    public function handle(DocumentDeliveryStatusRecalculationRequested $event): void {
        match (true) {
            $event->document instanceof SalesOrder    => app(SalesOrderService::class)->updateSalesOrderStatus($event->document),
            $event->document instanceof InternalOrder => app(InternalOrderService::class)->updateInternalOrderStatus($event->document),
            default                                   => throw new \RuntimeException('Unsupported document type: ' . get_class($event->document)),
        };
    }
}
