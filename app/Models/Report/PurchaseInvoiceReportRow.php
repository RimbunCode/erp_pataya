<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;

/**
 * Baris Laporan Invoice Pembelian: pembacaan read-only atas view report_purchase_invoices,
 * satu baris per Purchase Invoice. Izin dicek pada modul Finances lewat controller.
 */
class PurchaseInvoiceReportRow extends Model {
    use DataTable;

    protected $table                        = 'report_purchase_invoices';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.purchase_invoice';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'supplier_invoice' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'transaction_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 1,
        ],
        'supplier_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'purchase_order_code' => [
            'show'  => true,
            'order' => 3,
        ],
        'dpp_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 4,
        ],
        'discount_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 5,
        ],
        'tax_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 6,
        ],
        'total_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 7,
        ],
        'paid_total' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 8,
        ],
        'last_payment_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 9,
        ],
        'outstanding_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 10,
        ],
        'external_note' => [
            'show'  => true,
            'order' => 11,
        ],
        'payment_label' => [
            'show'      => true,
            'order'     => 12,
            'dependsOn' => ['payment_status'],
        ],
        'supplier_id' => [
            'ignore' => true,
        ],
        'purchase_order_id' => [
            'ignore' => true,
        ],
        'item_count' => [
            'ignore' => true,
        ],
        'payment_status' => [
            'ignore' => true,
        ],
    ];

    public static function getDefaultSortColumn(): string {
        return 'transaction_date';
    }

    public static function templateLink(): string {
        return ':supplier_invoice';
    }

    /**
     * Tautan kolom `supplier_invoice` mengarah ke route Purchase Invoice. Id baris sama
     * dengan id invoice.
     */
    public function getNameClass() {
        return 'purchaseInvoice';
    }

    /** Status pembayaran dalam bahasa Indonesia. */
    public function getPaymentLabelAttribute(): string {
        return __('report.purchase_invoice.payment.' . ($this->payment_status ?? 'belum'));
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
