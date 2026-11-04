<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

/**
 * Periode fiskal (Finance Fase 1, Requirement 6.1). Jurnal hanya boleh diposting pada periode `open` bila
 * `finance_enforce_fiscal_period` aktif (Requirement 6.5).
 */
class FiscalPeriod extends Model {
    use DataTable, HasUlids;

    public const STATUS_OPEN   = 'open';
    public const STATUS_CLOSED = 'closed';

    /**
     * Status dan jejak penutupan hanya diubah lewat `FiscalPeriodService::close()/open()` (izin
     * `close_period`/`reopen_period`, audit), bukan mass assignment.
     *
     * @var list<string>
     */
    protected $guarded = ['id', 'status', 'closed_at', 'closed_by_id'];

    public string $translateKey = 'finances.fiscalPeriod';
    protected $casts            = [
        'start_date' => 'date',
        'end_date'   => 'date',
        'closed_at'  => 'datetime',
    ];

    protected static function extraPermissions(): array {
        return ['close_period', 'reopen_period'];
    }

    protected $configColumns = [
        'name' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'fiscalYear' => [
            'order' => 1,
            'show'  => true,
        ],
        'start_date' => [
            'order' => 2,
            'show'  => true,
        ],
        'end_date' => [
            'order' => 3,
            'show'  => true,
        ],
        'status' => [
            'order'      => 4,
            'show'       => true,
            'valueTrans' => 'finances.fiscalPeriod.columns.status.options',
            'groupable'  => true,
        ],
        'closed_at' => [
            'order' => 5,
            'show'  => true,
        ],
        'fiscal_year_id' => [
            'ignore' => true,
        ],
        'closed_by_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':name';
    }

    public function isOpen(): bool {
        return $this->status === self::STATUS_OPEN;
    }

    public function fiscalYear() {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }

    public function closedBy() {
        return $this->belongsTo(User::class, 'closed_by_id');
    }
}
