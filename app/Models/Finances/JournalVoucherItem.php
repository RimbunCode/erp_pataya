<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Baris Journal Voucher: akun, debit atau kredit (salah satu), dan keterangan. Bukan baris GL; baris GL baru terbentuk
 * saat voucher disetujui dan diposting `JournalService`.
 */
class JournalVoucherItem extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'journalVoucher';

    /**
     * Memakai namespace lang dokumen induk (pola `QuotationItem`): kolom baris didefinisikan di array `columns`
     * milik induk.
     */
    public string $translateKey = 'finances.journalVoucher';

    protected $guarded = ['id'];
    protected $casts   = [
        'debit'   => 'decimal:4',
        'credit'  => 'decimal:4',
        'line_no' => 'integer',
    ];
    protected array $configColumns = [
        'account' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 0,
        ],
        'description' => [
            'show'  => true,
            'order' => 1,
        ],
        'debit' => [
            'show'  => true,
            'order' => 2,
        ],
        'credit' => [
            'show'  => true,
            'order' => 3,
        ],
    ];

    public static function templateLink() {
        return ':account';
    }

    public function journalVoucher(): BelongsTo {
        return $this->belongsTo(JournalVoucher::class);
    }

    public function account(): BelongsTo {
        return $this->belongsTo(Account::class);
    }
}
