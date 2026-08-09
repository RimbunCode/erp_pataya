<?php

namespace Tests\Unit\Listeners\Purchase\Order;

use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Listeners\Purchase\Order\RecalculatePurchaseOrderReceiveStatus;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Purchase\PurchaseOrderService;
use Tests\TestCase;

class RecalculatePurchaseOrderReceiveStatusTest extends TestCase {
    public function test_resolves_service_via_container(): void {
        $purchaseOrder = \Mockery::mock(PurchaseOrder::class);

        $mockService = \Mockery::mock(PurchaseOrderService::class);
        $mockService->shouldReceive('updatePurchaseOrderReceiveStatus')
            ->once()
            ->with($purchaseOrder);

        $this->app->instance(PurchaseOrderService::class, $mockService);

        $event    = new PurchaseOrderReceiveStatusRecalculationRequested($purchaseOrder);
        $listener = new RecalculatePurchaseOrderReceiveStatus;
        $listener->handle($event);

        $this->addToAssertionCount(1);
    }
}
