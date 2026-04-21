<?php

namespace Tests\Unit\Purchase;

use App\Models\Core\ModelConnection;
use App\Models\Purchase\PurchaseOrderItem;
use App\Services\Purchase\PurchaseOrderService;
use Illuminate\Support\Collection;
use Tests\TestCase;

class PurchaseOrderServiceTest extends TestCase {
    public function test_unique_model_connections_by_identity_preserves_different_model_types_with_same_id(): void {
        $service = new PurchaseOrderService;
        $method  = new \ReflectionMethod($service, 'uniqueModelConnectionsByIdentity');
        $method->setAccessible(true);

        /** @var array<int, array<string, mixed>> $connections */
        $connections = [
            [
                'model_type'     => 'App\\Models\\Purchase\\PurchaseRequestItem',
                'model_id'       => 'same-ulid',
                'reference_type' => PurchaseOrderItem::class,
                'reference_id'   => 'po-item-1',
            ],
            [
                'model_type'     => 'App\\Models\\Purchase\\PurchaseRequestItem',
                'model_id'       => 'same-ulid',
                'reference_type' => PurchaseOrderItem::class,
                'reference_id'   => 'po-item-1',
            ],
            [
                'model_type'     => 'App\\Models\\Service\\WorkOrderItem',
                'model_id'       => 'same-ulid',
                'reference_type' => PurchaseOrderItem::class,
                'reference_id'   => 'po-item-1',
            ],
        ];

        /** @var array<int, array<string, mixed>> $result */
        $result = $method->invoke($service, $connections);

        $this->assertCount(2, $result);
    }

    public function test_map_ordered_quantities_by_reference_sums_each_reference_pair(): void {
        $service = new PurchaseOrderService;
        $method  = new \ReflectionMethod($service, 'mapOrderedQuantitiesByReference');
        $method->setAccessible(true);

        $first                 = new ModelConnection;
        $first->reference_type = 'App\\Models\\Purchase\\PurchaseRequestItem';
        $first->reference_id   = 'source-1';
        $first->data           = ['ordered_quantity' => 2];

        $second                 = new ModelConnection;
        $second->reference_type = 'App\\Models\\Purchase\\PurchaseRequestItem';
        $second->reference_id   = 'source-1';
        $second->data           = ['ordered_quantity' => 3.5];

        $third                 = new ModelConnection;
        $third->reference_type = 'App\\Models\\Purchase\\PurchaseRequestItem';
        $third->reference_id   = 'source-2';
        $third->data           = [];

        /** @var array<string, float> $result */
        $result = $method->invoke($service, new Collection([$first, $second, $third]));

        $this->assertEquals(5.5, $result['App\\Models\\Purchase\\PurchaseRequestItem|source-1']);
        $this->assertEquals(0.0, $result['App\\Models\\Purchase\\PurchaseRequestItem|source-2']);
    }
}
