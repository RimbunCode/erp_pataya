<?php

namespace Tests\Feature\Core;

use App\Contracts\SubmitableService;
use App\Services\CRM\QuotationService;
use App\Services\Finances\PaymentEntryService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Inventory\DeliveryNoteService;
use App\Services\Inventory\StockEntryService;
use App\Services\Purchase\PurchaseOrderService;
use App\Services\Purchase\PurchaseReceiptService;
use App\Services\Purchase\PurchaseRequestService;
use App\Services\Sales\InternalOrderService;
use App\Services\Sales\SalesOrderService;
use App\Services\Service\WorkOrderService;
use Tests\TestCase;

class SubmitableServiceContractTest extends TestCase {
    /**
     * Seluruh 12 Service dokumen submitable yang dipanggil dari
     * checkApproval() harus implement SubmitableService setelah
     * migrasi — test ini mencegah drift di masa depan (Service
     * baru lupa implement kontrak, atau Service lama belum di-update).
     */
    public function test_all_12_submitable_services_implement_submitable_service_contract(): void {
        $services = [
            SalesOrderService::class,
            PurchaseOrderService::class,
            PurchaseRequestService::class,
            PurchaseReceiptService::class,
            PurchaseInvoiceService::class,
            SalesInvoiceService::class,
            PaymentEntryService::class,
            DeliveryNoteService::class,
            StockEntryService::class,
            InternalOrderService::class,
            WorkOrderService::class,
            QuotationService::class,
        ];

        foreach ($services as $serviceClass) {
            $this->assertTrue(
                is_subclass_of($serviceClass, SubmitableService::class),
                "{$serviceClass} harus implement " . SubmitableService::class,
            );
        }
    }
}
