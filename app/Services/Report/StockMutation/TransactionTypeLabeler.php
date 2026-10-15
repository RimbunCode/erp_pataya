<?php

namespace App\Services\Report\StockMutation;

use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockEntry;
use App\Models\Purchase\PurchaseReceipt;

/**
 * Menerjemahkan `referenceable_type` pada stock_ledger_entries menjadi label
 * berbahasa Indonesia (spec modul-laporan, Req 9.4 dan 9.5).
 *
 * Peta ini disusun dari kode, bukan dari isi database: daftar kelas yang menulis
 * ke stock_ledger_entries lewat StockLedgerEntry::create() adalah PurchaseReceipt
 * (PurchaseReceiptService), DeliveryNote (DeliveryNoteService), StockEntry
 * (StockEntryService), dan PurchaseInvoice (PurchaseInvoiceService, pada
 * penyesuaian nilai over-bill). Submitable hanya meng-update baris yang sudah ada.
 */
final class TransactionTypeLabeler {
    /** FQCN dokumen sumber => kunci terjemahan di lang report.transaction_type. */
    private const LABEL_KEYS = [
        PurchaseReceipt::class => 'purchase_receipt',
        DeliveryNote::class    => 'delivery_note',
        StockEntry::class      => 'stock_entry',
        PurchaseInvoice::class => 'purchase_invoice',
    ];

    /**
     * Label untuk satu entri. Null menghasilkan label "tidak diketahui", FQCN yang
     * tidak ada di peta jatuh ke nama kelas pendeknya (Req 9.5), supaya kolom tidak
     * pernah kosong dan tidak pernah gagal.
     */
    public function label(?string $referenceableType): string {
        if ($referenceableType === null || $referenceableType === '') {
            return __('report.transaction_type.unknown');
        }

        $key = self::LABEL_KEYS[$referenceableType] ?? null;

        if ($key === null) {
            return class_basename($referenceableType);
        }

        return __("report.transaction_type.{$key}");
    }
}
