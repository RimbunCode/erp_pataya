<?php

namespace App\Models\Finances;

use App\Exceptions\Finances\ImmutableLedgerException;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class GeneralLedger extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'debit'            => 'float',
        'credit'           => 'float',
        'transaction_date' => 'datetime',
        'line_no'          => 'integer',
        'foreign_debit'    => 'decimal:4',
        'foreign_credit'   => 'decimal:4',
        'exchange_rate'    => 'decimal:8',
    ];
    protected static string $defaultFormatCode = 'GL-@[iiii]/@[yy]';
    protected static $generateCodeSeries       = true;
    public string $translateKey                = 'finances.generalLedger';

    public static function getDefaultSortColumn(): string {
        return 'transaction_date';
    }

    protected static function permissions() {
        return [
            'select',
            'read',
            'export',
            'print',
        ];
    }

    public static function boot() {
        parent::boot();
        self::creating(function ($model) {
            $model->code = FormatingSeries::generate(GeneralLedger::class, $model->toArray());
        });

        // Guard immutability (Finance Fase 1, Requirement 4.1-4.2, D-7). Hanya baris yang sudah punya `journal_id`
        // yang dilindungi; baris legacy tanpa jurnal tidak berubah perilakunya. Guard ini tidak dipicu oleh
        // update/delete massal lewat query builder (mis. hook cancel `Submitable`, pengecualian legacy Requirement
        // 4.5) maupun SQL langsung (Requirement 4.4).
        self::updating(function (self $model) {
            $originalJournalId = $model->getOriginal('journal_id');

            if ($originalJournalId === null) {
                // Jalur backfill: baris tanpa jurnal boleh diberi `journal_id` dan `line_no`, tidak ada yang lain.
                if ($model->journal_id === null || array_diff(array_keys($model->getDirty()), self::BACKFILL_ASSIGNABLE) === []) {
                    return;
                }
            }

            throw ImmutableLedgerException::line();
        });

        self::deleting(function (self $model) {
            if ($model->journal_id !== null) {
                throw ImmutableLedgerException::line();
            }
        });
    }

    /**
     * Kolom yang boleh berubah saat baris legacy diberi jurnal oleh backfill (Requirement 4.1).
     *
     * @var list<string>
     */
    public const BACKFILL_ASSIGNABLE = ['journal_id', 'line_no', 'updated_at'];

    public function journal() {
        return $this->belongsTo(Journal::class, 'journal_id');
    }

    protected $configColumns = [
        'code' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'account' => [
            'order'     => 1,
            'show'      => true,
            'groupable' => true,
        ],
        'againstAccount' => [
            'order' => 2,
            'show'  => true,
        ],
        'debit' => [
            'order'          => 3,
            'show'           => true,
            'groupAggregate' => 'sum',
        ],
        'credit' => [
            'order'          => 4,
            'show'           => true,
            'groupAggregate' => 'sum',
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
        // Kolom Fase 1: tampil di UI pada Task 10.4.
        'journal_id' => [
            'ignore' => true,
        ],
        'line_no' => [
            'ignore' => true,
        ],
        'foreign_currency_code' => [
            'ignore' => true,
        ],
        'foreign_debit' => [
            'ignore' => true,
        ],
        'foreign_credit' => [
            'ignore' => true,
        ],
        'exchange_rate' => [
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
        return ['account', 'againstAccount', 'branch', 'referenceable'];
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

    public function referenceable() {
        return $this->morphTo();
    }
}
