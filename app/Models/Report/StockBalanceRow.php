<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\HasBranch;

/**
 * Baris Laporan Stok Persediaan: pembacaan read-only atas view report_stock_balances.
 *
 * Laporan tidak punya izin sendiri (spec Req 6): izin dicek pada modul sumbernya
 * (Stock). Karena itu initPermissions() dikosongkan, supaya PermissionSeeder tidak
 * membuat baris Permission baru untuk model ini. Pembatasan cabang mengikuti gudang
 * lewat HasBranch (Req 6.4), dan jalur KPI memakai helper yang sama.
 */
class StockBalanceRow extends Model {
    use DataTable, HasBranch;

    protected $table                        = 'report_stock_balances';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.stock_balance';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'item_code' => [
            'show'  => true,
            'order' => 0,
        ],
        'item_name' => [
            'show'  => true,
            'order' => 1,
        ],
        'warehouse_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'unit_name' => [
            'show'  => true,
            'order' => 3,
        ],
        'quantity' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 4,
        ],
        'valuation_rate' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 5,
        ],
        'stock_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 6,
        ],
        'item_variant_id' => [
            'ignore' => true,
        ],
        'warehouse_id' => [
            'ignore' => true,
        ],
        'category_id' => [
            'ignore' => true,
        ],
    ];

    /** View ini tidak punya created_at; urutkan default berdasarkan kode item. */
    public static function getDefaultSortColumn(): string {
        return 'item_code';
    }

    public static function templateLink(): string {
        return ':item_code - :warehouse_name';
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
