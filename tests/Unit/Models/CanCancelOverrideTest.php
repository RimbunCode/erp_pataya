<?php

namespace Tests\Unit\Models;

use App\Enums\FormStatus;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Unit test murni untuk override canCancel() per-model (Requirement 3.5) —
 * tanpa DB, langsung set attribute status dan assert method canCancel().
 * Menghindari RefreshDatabase karena skema test SQLite untuk model-model ini
 * tidak lengkap/tidak sinkron dengan production (mis. sales_orders tanpa
 * kolom status di migration test, suppliers tanpa is_example) — di luar
 * scope spec ini untuk diperbaiki.
 *
 * DeliveryNote dan PurchaseReceipt SENGAJA TIDAK di-override (keputusan user):
 * baseline Submitable (bukan DRAFT/CANCELED) sudah cukup untuk kedua model ini.
 */
class CanCancelOverrideTest extends TestCase {
    private function makeWithStatus(string $class, FormStatus $status): object {
        $model = new $class;
        $model->setRawAttributes(['status' => \json_encode([$status->value])]);

        return $model;
    }

    /**
     * SalesOrder & PurchaseOrder: false untuk salah satu dari 7 status
     * (delivered/partially_delivered/received/partially_received/billed/
     * partially_billed/completed).
     */
    public static function orderBlockingStatusesProvider(): array {
        return [
            'delivered'           => [FormStatus::DELIVERED],
            'partially_delivered' => [FormStatus::PARTIALLY_DELIVERED],
            'received'            => [FormStatus::RECEIVED],
            'partially_received'  => [FormStatus::PARTIALLY_RECEIVED],
            'billed'              => [FormStatus::BILLED],
            'partially_billed'    => [FormStatus::PARTIALLY_BILLED],
            'completed'           => [FormStatus::COMPLETED],
        ];
    }

    #[DataProvider('orderBlockingStatusesProvider')]
    public function test_sales_order_cannot_cancel_when_status_blocks(FormStatus $status): void {
        $model = $this->makeWithStatus(SalesOrder::class, $status);
        $this->assertFalse($model->canCancel());
    }

    public function test_sales_order_can_cancel_when_need_approval(): void {
        $model = $this->makeWithStatus(SalesOrder::class, FormStatus::NEED_APPROVAL);
        $this->assertTrue($model->canCancel());
    }

    #[DataProvider('orderBlockingStatusesProvider')]
    public function test_purchase_order_cannot_cancel_when_status_blocks(FormStatus $status): void {
        $model = $this->makeWithStatus(PurchaseOrder::class, $status);
        $this->assertFalse($model->canCancel());
    }

    public function test_purchase_order_can_cancel_when_need_approval(): void {
        $model = $this->makeWithStatus(PurchaseOrder::class, FormStatus::NEED_APPROVAL);
        $this->assertTrue($model->canCancel());
    }

    /**
     * SalesInvoice & PurchaseInvoice: samakan, false untuk paid/partially_paid.
     */
    public function test_sales_invoice_cannot_cancel_when_paid(): void {
        $model = $this->makeWithStatus(SalesInvoice::class, FormStatus::PAID);
        $this->assertFalse($model->canCancel());
    }

    public function test_sales_invoice_cannot_cancel_when_partially_paid(): void {
        $model = $this->makeWithStatus(SalesInvoice::class, FormStatus::PARTIALLY_PAID);
        $this->assertFalse($model->canCancel());
    }

    public function test_sales_invoice_can_cancel_when_unpaid(): void {
        $model = $this->makeWithStatus(SalesInvoice::class, FormStatus::UNPAID);
        $this->assertTrue($model->canCancel());
    }

    public function test_purchase_invoice_cannot_cancel_when_paid(): void {
        $model = $this->makeWithStatus(PurchaseInvoice::class, FormStatus::PAID);
        $this->assertFalse($model->canCancel());
    }

    public function test_purchase_invoice_cannot_cancel_when_partially_paid(): void {
        $model = $this->makeWithStatus(PurchaseInvoice::class, FormStatus::PARTIALLY_PAID);
        $this->assertFalse($model->canCancel());
    }

    public function test_purchase_invoice_can_cancel_when_to_bill(): void {
        $model = $this->makeWithStatus(PurchaseInvoice::class, FormStatus::TO_BILL);
        $this->assertTrue($model->canCancel());
    }

    public function test_work_order_cannot_cancel_when_completed(): void {
        $model = $this->makeWithStatus(WorkOrder::class, FormStatus::COMPLETED);
        $this->assertFalse($model->canCancel());
    }

    public function test_work_order_can_cancel_when_in_progress(): void {
        $model = $this->makeWithStatus(WorkOrder::class, FormStatus::IN_PROGRESS);
        $this->assertTrue($model->canCancel());
    }
}
