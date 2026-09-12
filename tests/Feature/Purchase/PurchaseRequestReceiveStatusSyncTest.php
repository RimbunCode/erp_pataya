<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Models\Inventory\ItemVariant;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseRequestService;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Requirement: PR harus ikut sync ("Selesai") begitu seluruh barang di semua
 * PO turunannya sudah diterima -- lihat docs/modules/purchase.md#alur-status-pr.
 * Sebelumnya PurchaseRequestItem.received_quantity tidak pernah di-update
 * kode manapun (kolom mati), jadi status PR mentok di ORDERED selamanya.
 */
class PurchaseRequestReceiveStatusSyncTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // initPermissions() adalah bootstrapper self-healing schema project ini --
        // menambahkan kolom Submitable standar (code/status/branch_id/created_by_id/dst)
        // via Schema::hasColumn guard, BUKAN lewat migration biasa (lihat
        // App\Traits\DataTable::initPermissions). Wajib dipanggil per model
        // sebelum create() pertama pada tabel fresh (mis. test DB).
        foreach ([PurchaseRequest::class, PurchaseOrder::class, Supplier::class] as $model) {
            $model::initPermissions();
        }

        $this->actingAs(User::factory()->create());
    }

    private function makePurchaseRequestItem(float $quantity): PurchaseRequestItem {
        $purchaseRequest = PurchaseRequest::create([
            'date' => now(),
            'code' => 'PR-' . fake()->unique()->numerify('####'),
            // Simulasikan PR yang sudah disetujui & sepenuhnya dipesan
            // (PurchaseRequestService::onApproved() ganti status jadi TO_ORDER;
            // replaceStatus() PR baru mengevaluasi progres begitu status dasarnya TO_ORDER).
            'status' => [FormStatus::TO_ORDER],
        ]);

        return PurchaseRequestItem::create([
            'purchase_request_id' => $purchaseRequest->id,
            'item_variant_id'     => ItemVariant::factory()->create()->id,
            'quantity'            => $quantity,
            'ordered_quantity'    => $quantity,
        ]);
    }

    private function makePurchaseOrderItem(PurchaseRequestItem $prItem, float $quantity, float $receivedQuantity): PurchaseOrderItem {
        $purchaseOrder = PurchaseOrderFactory::new()->create();

        return PurchaseOrderItem::create([
            'purchase_order_id'  => $purchaseOrder->id,
            'item_id'            => $prItem->item_variant_id,
            'referenceable_type' => PurchaseRequestItem::class,
            'referenceable_id'   => $prItem->id,
            'quantity'           => $quantity,
            'received_quantity'  => $receivedQuantity,
        ]);
    }

    public function test_sums_received_quantity_across_multiple_purchase_orders_for_same_pr_item(): void {
        $prItem = $this->makePurchaseRequestItem(quantity: 10.0);

        $poItem1 = $this->makePurchaseOrderItem($prItem, quantity: 6.0, receivedQuantity: 6.0);
        $poItem2 = $this->makePurchaseOrderItem($prItem, quantity: 4.0, receivedQuantity: 2.0);

        app(PurchaseRequestService::class)->updatePurchaseRequestReceiveStatus($poItem2->purchaseOrder);

        $this->assertEquals(8.0, $prItem->fresh()->received_quantity);
    }

    public function test_purchase_request_status_becomes_completed_once_fully_received(): void {
        $prItem = $this->makePurchaseRequestItem(quantity: 10.0);
        $poItem = $this->makePurchaseOrderItem($prItem, quantity: 10.0, receivedQuantity: 10.0);

        app(PurchaseRequestService::class)->updatePurchaseRequestReceiveStatus($poItem->purchaseOrder);

        $purchaseRequest = $prItem->purchaseRequest()->first();
        $this->assertTrue($purchaseRequest->append_status->contains(FormStatus::COMPLETED->value));
    }

    public function test_purchase_request_status_stays_ordered_when_partially_received(): void {
        $prItem = $this->makePurchaseRequestItem(quantity: 10.0);
        $poItem = $this->makePurchaseOrderItem($prItem, quantity: 10.0, receivedQuantity: 4.0);

        app(PurchaseRequestService::class)->updatePurchaseRequestReceiveStatus($poItem->purchaseOrder);

        $purchaseRequest = $prItem->purchaseRequest()->first();
        $this->assertTrue($purchaseRequest->append_status->contains(FormStatus::ORDERED->value));
        $this->assertFalse($purchaseRequest->append_status->contains(FormStatus::COMPLETED->value));
    }
}
