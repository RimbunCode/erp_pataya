<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Akun default sebuah peran pada Posting Profile (Finance Fase 2, Requirement 2.1); unik `(posting_profile_id,
 * role)`. `role` bertipe string agar dapat memuat peran kustom di luar enum `AccountRole` (Requirement 1.3).
 *
 * Tidak memakai `DataTable` (pola `JournalVoucherItem`): kolomnya didefinisikan di namespace lang profil induk.
 */
class PostingProfileAccount extends Model {
    use HasUlids;

    public static $parentRelation  = 'postingProfile';
    public string $translateKey    = 'finances.postingProfile';
    protected $guarded             = ['*'];
    protected array $configColumns = [
        'role' => [
            'order' => 0,
            'show'  => true,
        ],
        'account' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 1,
        ],
        'posting_profile_id' => [
            'ignore' => true,
        ],
        'account_id' => [
            'ignore' => true,
        ],
    ];

    public function postingProfile(): BelongsTo {
        return $this->belongsTo(PostingProfile::class, 'posting_profile_id');
    }

    public function account(): BelongsTo {
        return $this->belongsTo(Account::class, 'account_id')->withTrashed();
    }
}
