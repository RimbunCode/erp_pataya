<?php

namespace App\Models\Finances;

use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class GeneralLedger extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded                         = ['id'];
    protected $casts                           = ['debit' => 'float', 'credit' => 'float'];
    public string $translateKey                = 'finances.generalLedger';
    protected static $generateCodeSeries       = true;
    protected static string $defaultFormatCode = 'GL-@[iiii]/@[yy]';

    public static function boot() {
        parent::boot();
        self::creating(function ($model) {
            $model->code = FormatingSeries::generate(GeneralLedger::class, $model->toArray());
        });
    }

    protected array $configColumns = [
        'code' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'account' => [
            'order' => 1,
            'show'  => true,
        ],
        'againstAccount' => [
            'order' => 2,
            'show'  => true,
        ],
        'debit' => [
            'order' => 3,
            'show'  => true,
        ],
        'credit' => [
            'order' => 4,
            'show'  => true,
        ],
        'created_at' => [
            'order' => 5,
            'show'  => true,
        ],
        'branch' => [
            'ignore' => true,
        ],
        'partyable_id' => [
            'ignore' => true,
        ],
        'partyable_type' => [
            'ignore' => true,
        ],
        'referenceable_id' => [
            'ignore' => true,
        ],
        'referenceable_type' => [
            'ignore' => true,
        ],
    ];

    public function canDelete() {
        return false;
    }

    public static function templateLink() {
        return ':code';
    }

    public static function loadRelationsOnShow() {
        return ['account', 'againstAccount', 'branch'];
    }

    public function branch() {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function account() {
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function againstAccount() {
        return $this->belongsTo(Account::class, 'against_account_id');
    }

    public function partyable() {
        return $this->morphTo('partyable');
    }
}
