<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Posting Profile berversi (Finance Fase 2, Requirement 2): pemetaan peran akun ke akun default untuk seluruh
 * perusahaan (global, tanpa cakupan cabang), berlaku pada rentang tanggal, ditambah aturan akun bersyarat
 * (Requirement 12). Profil `active` yang sudah dipakai posting tidak diedit di tempat; perubahan lewat versi baru.
 *
 * Relasi baris bernama `accounts()` dan `rules()`, bukan `lines()`: `LedgerWriteAllowlistTest` memindai nama relasi
 * `lines()` sebagai penulisan GL.
 */
class PostingProfile extends Model {
    use DataTable, HasUlids;

    public const STATUS_DRAFT   = 'draft';
    public const STATUS_ACTIVE  = 'active';
    public const STATUS_RETIRED = 'retired';

    /**
     * Seluruh kolom dijaga dari mass assignment: hanya `PostingProfileService` yang menulis (lewat `forceFill`/
     * `forceCreate`) setelah validasi akun, rentang tanggal, dan tumpang-tindih.
     *
     * @var list<string>
     */
    protected $guarded = ['*'];

    public string $translateKey = 'finances.postingProfile';
    protected $casts            = [
        'effective_from' => 'date',
        'effective_to'   => 'date',
        'version'        => 'integer',
    ];

    /**
     * Izin Requirement 11.3: `select`, `read`, `write`, `activate`.
     *
     * @return string[]
     */
    protected static function permissions() {
        return [
            'select',
            'read',
            'write',
        ];
    }

    protected static function extraPermissions(): array {
        return ['activate'];
    }

    protected $configColumns = [
        'name' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'effective_from' => [
            'order' => 1,
            'show'  => true,
        ],
        'effective_to' => [
            'order' => 2,
            'show'  => true,
        ],
        'status' => [
            'order'      => 3,
            'show'       => true,
            'valueTrans' => 'finances.postingProfile.columns.status.options',
            'groupable'  => true,
        ],
        'version' => [
            'order' => 4,
            'show'  => true,
        ],
        'previous_profile_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':name';
    }

    /**
     * Lookup generik (`ModelController`) wajib memeriksa izin `select`: konfigurasi akun posting bukan data master
     * umum yang boleh dilihat setiap pengguna lewat LinkModel.
     */
    public static function lookupRequiresSelectPermission(): bool {
        return true;
    }

    /**
     * Hanya profil `draft` yang boleh dihapus (profil aktif/pensiun adalah riwayat konfigurasi).
     */
    public function canDelete() {
        return $this->isDraft();
    }

    public function isDraft(): bool {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isActive(): bool {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function accounts(): HasMany {
        return $this->hasMany(PostingProfileAccount::class, 'posting_profile_id');
    }

    public function rules(): HasMany {
        return $this->hasMany(PostingProfileRule::class, 'posting_profile_id');
    }

    public function previousProfile(): BelongsTo {
        return $this->belongsTo(self::class, 'previous_profile_id');
    }
}
