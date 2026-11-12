<?php

namespace App\Enums;

/**
 * Jenis dokumen yang diposting Posting Engine (Finance Fase 2, Requirement 4.3): sepuluh titik posting Fase 1.
 * Nilai string dipakai pada kunci setting mode (`finance_posting_mode.{value}`), tabel parity, dan aturan akun
 * bersyarat, sehingga TIDAK boleh diubah setelah dipakai.
 */
enum PostingDocumentType: string {
    case SalesInvoice         = 'sales_invoice';
    case PurchaseInvoice      = 'purchase_invoice';
    case PurchaseReceipt      = 'purchase_receipt';
    case DeliveryNote         = 'delivery_note';
    case PaymentEntry         = 'payment_entry';
    case StockEntry           = 'stock_entry';
    case AssetDepreciation    = 'asset_depreciation';
    case AssetScrap           = 'asset_scrap';
    case AssetValueAdjustment = 'asset_value_adjustment';
    case AssetDisposal        = 'asset_disposal';

    /**
     * Nilai-nilai enum sebagai daftar string (validasi `in:`, kolom filter).
     *
     * @return list<string>
     */
    public static function values(): array {
        return array_map(static fn (self $type): string => $type->value, self::cases());
    }
}
