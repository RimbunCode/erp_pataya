<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Support\Carbon;

/**
 * Baris Laporan Monitoring Work Order: pembacaan read-only atas view report_work_orders,
 * satu baris per AssetService. Izin dicek pada modul Asset / Service lewat controller.
 */
class WorkOrderMonitoringRow extends Model {
    use DataTable;

    protected $table                        = 'report_work_orders';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.work_order';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'asset_name' => [
            'show'  => true,
            'order' => 1,
        ],
        'service_type' => [
            'show'  => true,
            'order' => 2,
        ],
        'progress_label' => [
            'show'      => true,
            'order'     => 3,
            'dependsOn' => ['progress_status'],
        ],
        'transaction_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 4,
        ],
        'start_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 5,
        ],
        'completion_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 6,
        ],
        'duration_days' => [
            'type'      => 'numeric',
            'show'      => true,
            'order'     => 7,
            'dependsOn' => ['start_date', 'completion_date'],
        ],
        'asset_id' => [
            'ignore' => true,
        ],
        'progress_status' => [
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
     * Tautan kolom `code` mengarah ke route AssetService. Id baris sama dengan id AssetService.
     */
    public function getNameClass() {
        return 'assetService';
    }

    /** Lama pengerjaan dalam hari; yang belum selesai dihitung sampai saat ini (Req 14.5). */
    public function getDurationDaysAttribute(): ?float {
        return self::durationDays($this->start_date, $this->completion_date);
    }

    /**
     * Lama pengerjaan dalam hari. Null bila pekerjaan belum dimulai, karena tidak ada titik awal.
     */
    public static function durationDays(?string $startDate, ?string $completionDate): ?float {
        if ($startDate === null) {
            return null;
        }

        $start = Carbon::parse($startDate);
        $end   = $completionDate !== null ? Carbon::parse($completionDate) : now();

        return round($start->diffInSeconds($end, false) / 86400, 1);
    }

    /** Label status pengerjaan dalam bahasa Indonesia (Req 14.5). */
    public function getProgressLabelAttribute(): string {
        return __('report.work_order.progress.' . ($this->progress_status ?? 'berjalan'));
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
