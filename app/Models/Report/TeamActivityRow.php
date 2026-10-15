<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;

/**
 * Baris Laporan Anggota Tim: pembacaan read-only atas view report_team_activities, satu baris
 * per aktivitas servis. Izin dicek pada modul Asset / Service.
 */
class TeamActivityRow extends Model {
    use DataTable;

    protected $table                        = 'report_team_activities';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.team_activity';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'transaction_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 0,
        ],
        // Grouping memakai kolom SQL pic_name; pic_label hanya untuk tampilan (Req 16.5).
        'pic_name' => [
            'show'      => false,
            'groupable' => true,
        ],
        'pic_label' => [
            'show'      => true,
            'order'     => 1,
            'dependsOn' => ['pic_name'],
        ],
        // Bukan isLink: tautan DataTable memakai id baris (id aktivitas), sedangkan dokumen
        // AssetService butuh id pekerjaan. Lihat catatan gap di gap-app-lama.md.
        'code' => [
            'show'  => true,
            'order' => 2,
        ],
        'asset_name' => [
            'show'  => true,
            'order' => 3,
        ],
        'activity_status' => [
            'show'  => true,
            'order' => 4,
        ],
        'description' => [
            'show'  => true,
            'order' => 5,
        ],
        'pic_id' => [
            'ignore' => true,
        ],
        'asset_id' => [
            'ignore' => true,
        ],
        'asset_service_id' => [
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
     * Nama PIC, atau penanda "Tanpa PIC" bila aktivitas belum punya PIC (Req 16.5).
     */
    public function getPicLabelAttribute(): string {
        return $this->pic_name ?? __('report.team.no_pic');
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
