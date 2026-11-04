<?php

namespace App\Models\Finances;

use App\Exceptions\Finances\ImmutableLedgerException;
use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

/**
 * Header jurnal (Finance Fase 1). Berisi N baris `general_ledgers` (model `GeneralLedger`) yang dijamin seimbang
 * oleh `JournalService`. Tidak memakai SoftDeletes: jurnal tidak pernah dihapus (Requirement 1.1, FR-L3).
 *
 * Kolom `status` berupa string nilai `JournalStatus` (tanpa cast enum): `LinkModel::getAppendStatusAttribute`
 * mengharapkan `status` berupa string/array/`FormStatus`, bukan enum lain.
 *
 * Guard immutability (Requirement 4.3): `update` dan `delete` lewat model ditolak. Perubahan status/tautan reversal
 * dan penandaan `voided` dilakukan hanya lewat query builder di dalam service (`Journal::query()->...->update()`),
 * yang tidak memicu event model. Guard ini melindungi dari penggunaan ORM yang tidak disengaja, bukan dari SQL
 * langsung (Requirement 4.4, D-7).
 */
class Journal extends Model {
    use DataTable, HasUlids;

    /**
     * Kolom integritas (status, kunci idempotensi, total, tautan reversal, asal legacy, jejak posting) tidak dapat
     * diisi lewat mass assignment (mis. `fill($request->all())`); hanya service yang menulisnya, lewat
     * `forceCreate()`/query builder (mengikuti pola `ModuleSetting`: `$guarded` diperluas, bukan `$fillable`).
     *
     * @var list<string>
     */
    protected $guarded = [
        'id',
        'status',
        'posting_key',
        'total_debit',
        'total_credit',
        'reverses_journal_id',
        'reversed_by_journal_id',
        'reversal_reason',
        'legacy_origin',
        'legacy_unbalanced',
        'posted_at',
        'posted_by_id',
    ];

    protected static string $defaultFormatCode = 'JV-@[iiii]/@[yy]';
    protected static $generateCodeSeries       = true;
    public string $translateKey                = 'finances.journal';
    protected $casts                           = [
        'transaction_date'  => 'datetime',
        'posted_at'         => 'datetime',
        'total_debit'       => 'decimal:4',
        'total_credit'      => 'decimal:4',
        'legacy_origin'     => 'boolean',
        'legacy_unbalanced' => 'boolean',
    ];

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

    /**
     * Izin `reverse` (Requirement 5.8, 14.1). Penegakannya di controller (Task 10.1), bukan di service: pengecekan
     * izin membaca sesi dan meng-abort 403, yang tidak pantas dilakukan dari dalam service.
     */
    protected static function extraPermissions(): array {
        return ['reverse'];
    }

    protected static function booted(): void {
        static::updating(function (self $journal) {
            throw ImmutableLedgerException::journal();
        });

        static::deleting(function (self $journal) {
            throw ImmutableLedgerException::journal();
        });
    }

    protected $configColumns = [
        'code' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'transaction_date' => [
            'order' => 1,
            'show'  => true,
        ],
        'status' => [
            'order'      => 2,
            'show'       => true,
            'valueTrans' => 'finances.journal.columns.status.options',
            'groupable'  => true,
        ],
        'total_debit' => [
            'order'          => 3,
            'show'           => true,
            'groupAggregate' => 'sum',
        ],
        'total_credit' => [
            'order'          => 4,
            'show'           => true,
            'groupAggregate' => 'sum',
        ],
        'fiscalPeriod' => [
            'order' => 5,
            'show'  => true,
        ],
        'branch' => [
            'ignore' => true,
        ],
        'source_id' => [
            'ignore' => true,
        ],
        'source_type' => [
            'ignore' => true,
        ],
        'fiscal_period_id' => [
            'ignore' => true,
        ],
        'branch_id' => [
            'ignore' => true,
        ],
        'reverses_journal_id' => [
            'ignore' => true,
        ],
        'reversed_by_journal_id' => [
            'ignore' => true,
        ],
        'posted_by_id' => [
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
        return ['fiscalPeriod', 'branch', 'source', 'reverses', 'reversedBy', 'postedBy'];
    }

    public function lines() {
        return $this->hasMany(GeneralLedger::class, 'journal_id')->orderBy('line_no');
    }

    public function source() {
        return $this->morphTo('source');
    }

    public function fiscalPeriod() {
        return $this->belongsTo(FiscalPeriod::class, 'fiscal_period_id');
    }

    public function reverses() {
        return $this->belongsTo(self::class, 'reverses_journal_id');
    }

    public function reversedBy() {
        return $this->belongsTo(self::class, 'reversed_by_journal_id');
    }

    public function postedBy() {
        return $this->belongsTo(User::class, 'posted_by_id');
    }

    public function branch() {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function currency() {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }
}
