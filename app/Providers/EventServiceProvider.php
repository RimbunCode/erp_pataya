<?php

namespace App\Providers;

use App\Events\Asset\AssetDepreciationDue;
use App\Events\Asset\AssetScrapped;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Core\ApprovalDecided;
use App\Events\Core\AuditableModelSaved;
use App\Events\Core\DocumentCanceled;
use App\Events\Core\DocumentStatusChanged;
use App\Events\Core\DocumentSubmitted;
use App\Events\CRM\LeadConvertedToCustomer;
use App\Events\Finances\PaymentApplied;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Inventory\StockReservationChanged;
use App\Events\Purchase\Invoice\PurchaseInvoiceReturnStatusChanged;
use App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged;
use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Events\Sales\Invoice\SalesInvoiceReturnStatusChanged;
use App\Events\Sales\Invoice\SalesOrderItemBillingChanged;
use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Listeners\Asset\CreateAssetFromPurchase;
use App\Listeners\Asset\Depreciation\PostDepreciationEntry;
use App\Listeners\Asset\Depreciation\PostScrapWriteOff;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Listeners\Core\Approval\AttachApprovalPdf;
use App\Listeners\Core\Approval\CancelPendingApprovalSteps;
use App\Listeners\Core\Approval\NotifyApprovalDecision;
use App\Listeners\Core\Approval\NotifyNextApprover;
use App\Listeners\Core\Audit\RecordAuditLog;
use App\Listeners\Core\Submission\CreateDocumentConnection;
use App\Listeners\Core\Submission\NotifyRoleOnStatusChange;
use App\Listeners\CRM\CreateCustomerFromLead;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Finances\Payment\UpdatePaymentableStatus;
use App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger;
use App\Listeners\Inventory\Stock\UpdateStockReservation;
use App\Listeners\Purchase\Invoice\UpdatePurchaseInvoiceReturnStatus;
use App\Listeners\Purchase\Invoice\UpdatePurchaseOrderItemBilling;
use App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger;
use App\Listeners\Purchase\Order\RecalculatePurchaseOrderBillStatus;
use App\Listeners\Purchase\Order\RecalculatePurchaseOrderReceiveStatus;
use App\Listeners\Sales\Invoice\UpdateSalesInvoiceReturnStatus;
use App\Listeners\Sales\Invoice\UpdateSalesOrderItemBilling;
use App\Listeners\Sales\Order\RecalculateDocumentDeliveryStatus;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider {
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        DocumentCanceled::class => [
            CancelPendingApprovalSteps::class,
        ],
        AuditableModelSaved::class => [
            RecordAuditLog::class,
        ],
        ApprovalDecided::class => [
            AttachApprovalPdf::class,
            NotifyApprovalDecision::class,
            NotifyNextApprover::class,
        ],
        DocumentStatusChanged::class => [
            NotifyRoleOnStatusChange::class,
        ],
        DocumentSubmitted::class => [
            CreateDocumentConnection::class,
        ],
        StockReservationChanged::class => [
            UpdateStockReservation::class,
        ],
        PaymentApplied::class => [
            UpdatePaymentableStatus::class,
        ],
        DocumentDeliveryStatusRecalculationRequested::class => [
            RecalculateDocumentDeliveryStatus::class,
        ],
        PurchaseOrderBillStatusRecalculationRequested::class => [
            RecalculatePurchaseOrderBillStatus::class,
        ],
        PurchaseOrderReceiveStatusRecalculationRequested::class => [
            RecalculatePurchaseOrderReceiveStatus::class,
        ],
        SalesOrderItemBillingChanged::class => [
            UpdateSalesOrderItemBilling::class,
        ],
        SalesInvoiceReturnStatusChanged::class => [
            UpdateSalesInvoiceReturnStatus::class,
        ],
        PurchaseOrderItemBillingChanged::class => [
            UpdatePurchaseOrderItemBilling::class,
        ],
        PurchaseInvoiceReturnStatusChanged::class => [
            UpdatePurchaseInvoiceReturnStatus::class,
        ],
        PurchaseReceiptGeneralLedgerPostingRequested::class => [
            PostPurchaseReceiptGeneralLedger::class,
        ],
        DeliveryNoteGeneralLedgerPostingRequested::class => [
            PostDeliveryNoteGeneralLedger::class,
        ],
        PurchaseInvoiceGeneralLedgerPostingRequested::class => [
            PostPurchaseInvoiceGeneralLedger::class,
        ],
        LeadConvertedToCustomer::class => [
            CreateCustomerFromLead::class,
        ],
        FixedAssetItemApproved::class => [
            CreateAssetFromPurchase::class,
        ],
        AssetDepreciationDue::class => [
            PostDepreciationEntry::class,
        ],
        AssetScrapped::class => [
            PostScrapWriteOff::class,
        ],
        AssetValueAdjustmentApproved::class => [
            PostValueAdjustmentEntry::class,
        ],
    ];

    /**
     * Nonaktifkan auto-discovery listener dari app/Listeners/ untuk instance
     * provider ini. $listen manual di atas adalah satu-satunya sumber
     * kebenaran registrasi event di proyek ini.
     *
     * Catatan: Laravel selalu mendaftarkan Illuminate\Foundation\Support\
     * Providers\EventServiceProvider (base class) sebagai provider TERPISAH
     * lewat Application::configure()->withEvents() (default), independen
     * dari provider App ini. Override method ini TIDAK mencegah instance
     * base class tersebut auto-discover — pencegahannya ada di
     * bootstrap/app.php via withEvents(discover: false). Override ini
     * murni defense-in-depth untuk instance App\Providers\EventServiceProvider.
     */
    public function shouldDiscoverEvents(): bool {
        return false;
    }
}
