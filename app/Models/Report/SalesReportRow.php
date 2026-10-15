<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;

/**
 * Baris Laporan Penjualan: pembacaan read-only atas view report_sales, satu baris per
 * Sales Order. Izin dicek pada modul Sales lewat controller, bukan di sini.
 */
class SalesReportRow extends Model {
    use DataTable;

    protected $table                        = 'report_sales';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.sales';
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
        'total_quantity' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 3,
        ],
        'sales_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 4,
        ],
        'tax_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 5,
        ],
        'invoice_code' => [
            'show'  => true,
            'order' => 6,
        ],
        'payment_label' => [
            'show'      => true,
            'order'     => 7,
            'dependsOn' => ['invoice_status'],
        ],
        'delivery_label' => [
            'show'      => true,
            'order'     => 8,
            'dependsOn' => ['delivery_status'],
        ],
        'customer_id' => [
            'ignore' => true,
        ],
        'invoice_status' => [
            'ignore' => true,
        ],
        'delivery_status' => [
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
     * Tautan kolom `code` mengarah ke route Sales Order (Req 10.6). Id baris sama
     * dengan id Sales Order, jadi tautan `salesOrders.show` langsung valid.
     */
    public function getNameClass() {
        return 'salesOrder';
    }

    /** Status pembayaran invoice dalam bahasa Indonesia (Req 10.3). */
    public function getPaymentLabelAttribute(): string {
        return __('report.sales.payment.' . ($this->invoice_status ?? 'belum_ada'));
    }

    /** Status pengiriman dalam bahasa Indonesia (Req 10.3). */
    public function getDeliveryLabelAttribute(): string {
        return __('report.sales.delivery.' . ($this->delivery_status ?? 'belum'));
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
