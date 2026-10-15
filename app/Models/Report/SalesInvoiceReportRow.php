<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;

/**
 * Baris Laporan Invoice Penjualan: pembacaan read-only atas view report_sales_invoices,
 * satu baris per Sales Invoice. Izin dicek pada modul Finances lewat controller.
 */
class SalesInvoiceReportRow extends Model {
    use DataTable;

    protected $table                        = 'report_sales_invoices';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.sales_invoice';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'transaction_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 1,
        ],
        'customer_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'sales_order_code' => [
            'show'  => true,
            'order' => 3,
        ],
        'dpp_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 4,
        ],
        'tax_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 5,
        ],
        'total_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 6,
        ],
        'paid_total' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 7,
        ],
        'last_payment_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 8,
        ],
        'outstanding_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 9,
        ],
        'payment_label' => [
            'show'      => true,
            'order'     => 10,
            'dependsOn' => ['payment_status'],
        ],
        'customer_id' => [
            'ignore' => true,
        ],
        'sales_order_id' => [
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
        return ':code';
    }

    /**
     * Tautan kolom `code` mengarah ke route Sales Invoice. Id baris sama dengan id invoice.
     */
    public function getNameClass() {
        return 'salesInvoice';
    }

    /** Status pembayaran dalam bahasa Indonesia. */
    public function getPaymentLabelAttribute(): string {
        return __('report.sales_invoice.payment.' . ($this->payment_status ?? 'belum'));
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
