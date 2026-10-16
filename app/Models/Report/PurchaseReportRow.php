<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;

/**
 * Baris Laporan Pembelian: pembacaan read-only atas view report_purchases, satu baris
 * per Purchase Order. Izin dicek pada modul Purchase lewat controller, bukan di sini.
 */
class PurchaseReportRow extends Model {
    use DataTable;

    protected $table                        = 'report_purchases';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.purchase';
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
        'supplier_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'total_quantity' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 3,
        ],
        'purchase_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 4,
        ],
        'tax_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 5,
        ],
        'supplier_id' => [
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
     * Tautan kolom `code` mengarah ke route Purchase Order (Req 12.6). Id baris sama
     * dengan id Purchase Order.
     */
    public function getNameClass() {
        return 'purchaseOrder';
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
