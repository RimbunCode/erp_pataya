<?php

namespace Tests\Unit\Listeners\Purchase\Request;

use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Listeners\Purchase\Request\RecalculatePurchaseRequestReceiveStatus;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Purchase\PurchaseRequestService;
use Tests\TestCase;

class RecalculatePurchaseRequestReceiveStatusTest extends TestCase {
    public function test_resolves_service_via_container(): void {
        $purchaseOrder = \Mockery::mock(PurchaseOrder::class);

        $mockService = \Mockery::mock(PurchaseRequestService::class);
        $mockService->shouldReceive('updatePurchaseRequestReceiveStatus')
            ->once()
            ->with($purchaseOrder);

        $this->app->instance(PurchaseRequestService::class, $mockService);

        $event    = new PurchaseRequestReceiveStatusRecalculationRequested($purchaseOrder);
        $listener = new RecalculatePurchaseRequestReceiveStatus;
        $listener->handle($event);

        $this->addToAssertionCount(1);
    }
}
