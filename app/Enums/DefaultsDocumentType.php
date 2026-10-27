<?php

namespace App\Enums;

use App\Models\CRM\Quotation;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Sales\SalesOrder;

enum DefaultsDocumentType: string {
    case PurchaseOrder   = 'purchase_order';
    case PurchaseReceipt = 'purchase_receipt';
    case PurchaseInvoice = 'purchase_invoice';
    case SalesOrder      = 'sales_order';
    case DeliveryNote    = 'delivery_note';
    case SalesInvoice    = 'sales_invoice';
    case Quotation       = 'quotation';

    /** @return class-string */
    public function modelClass(): string {
        return match ($this) {
            self::PurchaseOrder   => PurchaseOrder::class,
            self::PurchaseReceipt => PurchaseReceipt::class,
            self::PurchaseInvoice => PurchaseInvoice::class,
            self::SalesOrder      => SalesOrder::class,
            self::DeliveryNote    => DeliveryNote::class,
            self::SalesInvoice    => SalesInvoice::class,
            self::Quotation       => Quotation::class,
        };
    }

    public function module(): string {
        return match ($this) {
            self::PurchaseOrder, self::PurchaseReceipt, self::PurchaseInvoice => 'purchase',
            self::SalesOrder, self::DeliveryNote, self::SalesInvoice, self::Quotation => 'sales',
        };
    }

    public function supportsWarehouseDefault(): bool {
        return match ($this) {
            self::PurchaseOrder, self::PurchaseReceipt, self::SalesOrder, self::DeliveryNote => true,
            self::PurchaseInvoice, self::SalesInvoice, self::Quotation => false,
        };
    }

    /** Dokumen dengan kolom pajak per baris (Receipt dan Delivery Note tidak punya). */
    public function supportsTaxDefault(): bool {
        return match ($this) {
            self::PurchaseOrder, self::PurchaseInvoice, self::SalesOrder, self::SalesInvoice, self::Quotation => true,
            self::PurchaseReceipt, self::DeliveryNote => false,
        };
    }
}
