<?php

namespace App\Models\Finances;

use App\Enums\Permission;
use App\Models\Inventory\StockEntry;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdditionalCost extends Model {
    use HasUlids, SoftDeletes;

    /** Izin lihat nominal biaya tambahan: pembuat Stock Entry (referenceable). */
    private const AMOUNT_VISIBILITY = [
        [StockEntry::class, [Permission::Write, Permission::Create]],
    ];

    protected $guarded             = ['id'];
    protected $casts               = ['amount' => 'float'];
    protected $with                = ['expenseAccount'];
    protected array $configColumns = [
        'purpose' => [
            'show'  => true,
            'order' => 0,
        ],
        'amount' => [
            'show'       => true,
            'order'      => 1,
            'type'       => 'numeric',
            'visibleFor' => self::AMOUNT_VISIBILITY,
        ],
    ];

    public function referenceable() {
        return $this->morphTo();
    }

    public function expenseAccount() {
        return $this->belongsTo(Account::class, 'expense_account_id');
    }

    public string $translateKey = 'finances.additionalCost';
}
