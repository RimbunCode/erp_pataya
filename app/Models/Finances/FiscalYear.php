<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

/**
 * Tahun fiskal (Finance Fase 1, Requirement 6.1). Hanya status `open`/`closed` dasar; penutupan penuh adalah Fase 6.
 */
class FiscalYear extends Model {
    use DataTable, HasUlids;

    public const STATUS_OPEN   = 'open';
    public const STATUS_CLOSED = 'closed';

    /**
     * Status tahun fiskal tidak dapat diisi lewat mass assignment; hanya service yang menulisnya.
     *
     * @var list<string>
     */
    protected $guarded = ['id', 'status'];

    public string $translateKey = 'finances.fiscalYear';
    protected $casts            = [
        'start_date' => 'date',
        'end_date'   => 'date',
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
        'start_date' => [
            'order' => 1,
            'show'  => true,
        ],
        'end_date' => [
            'order' => 2,
            'show'  => true,
        ],
        'status' => [
            'order'      => 3,
            'show'       => true,
            'valueTrans' => 'finances.fiscalYear.columns.status.options',
            'groupable'  => true,
        ],
    ];

    public static function templateLink() {
        return ':name';
    }

    public function periods() {
        return $this->hasMany(FiscalPeriod::class, 'fiscal_year_id')->orderBy('start_date');
    }
}
