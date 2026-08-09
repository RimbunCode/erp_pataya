<?php

namespace Tests\Unit\Listeners\Purchase\Order;

use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Listeners\Purchase\Order\RecalculatePurchaseOrderBillStatus;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Purchase\PurchaseOrderService;
use Tests\TestCase;

class RecalculatePurchaseOrderBillStatusTest extends TestCase {
    public function test_resolves_service_via_container(): void {
        $purchaseOrder = \Mockery::mock(PurchaseOrder::class);
        $returnAgainst = null;

        $mockService = \Mockery::mock(PurchaseOrderService::class);
        $mockService->shouldReceive('updatePurchaseOrderBillStatus')
            ->once()
            ->with($purchaseOrder, $returnAgainst);

        $this->app->instance(PurchaseOrderService::class, $mockService);

        $event    = new PurchaseOrderBillStatusRecalculationRequested($purchaseOrder, $returnAgainst);
        $listener = new RecalculatePurchaseOrderBillStatus;
        $listener->handle($event);

        $this->addToAssertionCount(1);
    }

    public function test_passes_return_against_to_service(): void {
        $purchaseOrder = \Mockery::mock(PurchaseOrder::class);
        $returnAgainst = \Mockery::mock(PurchaseInvoice::class);

        $mockService = \Mockery::mock(PurchaseOrderService::class);
        $mockService->shouldReceive('updatePurchaseOrderBillStatus')
            ->once()
            ->with($purchaseOrder, $returnAgainst);

        $this->app->instance(PurchaseOrderService::class, $mockService);

        $event    = new PurchaseOrderBillStatusRecalculationRequested($purchaseOrder, $returnAgainst);
        $listener = new RecalculatePurchaseOrderBillStatus;
        $listener->handle($event);

        $this->addToAssertionCount(1);
    }
}
