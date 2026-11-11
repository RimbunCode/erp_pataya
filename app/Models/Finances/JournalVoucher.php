<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Services\Finances\JournalVoucherService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Jurnal manual dengan approval (Finance Fase 1, Task 11; Requirement 12; D-14, Q-P1-13). Dokumen ini submitable dan
 * memakai modul Approval; ia TIDAK menulis baris GL. Setelah disetujui, `JournalVoucherService::onApproved()`
 * memposting `Journal` lewat `JournalService::post()` dengan `source` = dokumen ini. `Journal` sendiri tidak punya
 * status draft dan tetap tidak dapat diubah.
 *
 * Relasi baris bernama `items()`, bukan `lines()`: `LedgerWriteAllowlistTest` memindai teks sumber dan menganggap
 * penulisan lewat relasi bernama `lines` di `app/` sebagai penulisan GL.
 */
class JournalVoucher extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    public static string $service              = JournalVoucherService::class;
    public string $formComponent               = 'Finances/JournalVouchers/Form';
    public string $translateKey                = 'finances.journalVoucher';
    public string $keyBreadcrumb               = 'code';
    protected static string $defaultFormatCode = 'JVC-@[iiii]/@[yy]';
    protected $guarded                         = ['id'];
    protected $casts                           = [
        'date' => 'datetime',
    ];

    public static function templateLink() {
        return ':code';
    }

    protected array $configColumns = [
        'code' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'date' => [
            'order' => 1,
            'show'  => true,
        ],
        'description' => [
            'order' => 2,
            'show'  => true,
        ],
        'status' => [
            'order' => 3,
            'show'  => true,
        ],
        'items',
    ];

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.account',
            'branch',
        ];
    }

    public function items(): HasMany {
        return $this->hasMany(JournalVoucherItem::class)->orderBy('line_no');
    }
}
