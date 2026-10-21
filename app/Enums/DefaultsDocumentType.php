<?php

namespace App\Enums;

enum DefaultsDocumentType: string {
    case PurchaseOrder   = 'purchase_order';
    case PurchaseReceipt = 'purchase_receipt';
    case PurchaseInvoice = 'purchase_invoice';
    case SalesOrder      = 'sales_order';
    case DeliveryNote    = 'delivery_note';
    case SalesInvoice    = 'sales_invoice';
    case Quotation       = 'quotation';
}
