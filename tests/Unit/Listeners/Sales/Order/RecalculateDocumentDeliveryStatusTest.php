<?php

namespace Tests\Unit\Listeners\Sales\Order;

use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Listeners\Sales\Order\RecalculateDocumentDeliveryStatus;
use App\Models\Model;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Services\Sales\InternalOrderService;
use App\Services\Sales\SalesOrderService;
use Tests\TestCase;

class RecalculateDocumentDeliveryStatusTest extends TestCase {
    public function test_resolves_sales_order_service_via_container(): void {
        $salesOrder = \Mockery::mock(SalesOrder::class);
        $salesOrder->shouldReceive('instanceof')->andReturn(true);

        $mockService = \Mockery::mock(SalesOrderService::class);
        $mockService->shouldReceive('updateSalesOrderStatus')
            ->once()
            ->with($salesOrder);

        $this->app->instance(SalesOrderService::class, $mockService);

        $event    = new DocumentDeliveryStatusRecalculationRequested($salesOrder);
        $listener = new RecalculateDocumentDeliveryStatus;
        $listener->handle($event);

        // Mockery assertion: updateSalesOrderStatus was called once
        $this->addToAssertionCount(1);
    }

    public function test_resolves_internal_order_service_via_container(): void {
        $internalOrder = \Mockery::mock(InternalOrder::class);
        $internalOrder->shouldReceive('instanceof')->andReturn(true);

        $mockService = \Mockery::mock(InternalOrderService::class);
        $mockService->shouldReceive('updateInternalOrderStatus')
            ->once()
            ->with($internalOrder);

        $this->app->instance(InternalOrderService::class, $mockService);

        $event    = new DocumentDeliveryStatusRecalculationRequested($internalOrder);
        $listener = new RecalculateDocumentDeliveryStatus;
        $listener->handle($event);

        $this->addToAssertionCount(1);
    }

    public function test_throws_exception_for_unsupported_document_type(): void {
        $unsupported = new class extends Model {};

        $event    = new DocumentDeliveryStatusRecalculationRequested($unsupported);
        $listener = new RecalculateDocumentDeliveryStatus;

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Unsupported document type');

        $listener->handle($event);
    }
}
