<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;

/**
 * Baris Laporan Pemakaian Sparepart: pembacaan read-only atas view report_sparepart_usages,
 * satu baris per item konsumsi AssetService. Izin dicek pada modul Asset / Service.
 */
class SparepartUsageRow extends Model {
    use DataTable;

    protected $table                        = 'report_sparepart_usages';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.sparepart_usage';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'transaction_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 0,
        ],
        // Bukan isLink: tautan DataTable memakai id baris (id item konsumsi), sedangkan
        // dokumen AssetService butuh id pekerjaan. Lihat catatan gap di gap-app-lama.md.
        'code' => [
            'show'  => true,
            'order' => 1,
        ],
        'asset_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'item_code' => [
            'show'  => true,
            'order' => 3,
        ],
        'item_name' => [
            'show'  => true,
            'order' => 4,
        ],
        'quantity' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 5,
        ],
        'unit_name' => [
            'show'  => true,
            'order' => 6,
        ],
        'unit_price' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 7,
        ],
        'total_value' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 8,
        ],
        'asset_id' => [
            'ignore' => true,
        ],
        'item_variant_id' => [
            'ignore' => true,
        ],
    ];

    public static function getDefaultSortColumn(): string {
        return 'transaction_date';
    }

    public static function templateLink(): string {
        return ':code';
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
