<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Versi aturan pajak berlaku-tanggal (Finance Fase 3, Requirement 2): tarif, faktor DPP (pecahan bilangan bulat),
 * mode pembulatan, dan peran akun (kunci peran Posting Profile; Tax Engine tidak mengetahui akun) untuk satu
 * pajak. Versi `active` yang sudah dirujuk dokumen tidak diedit di tempat; perubahan lewat versi baru dengan
 * tanggal berlaku baru.
 *
 * Seluruh kolom dijaga dari mass assignment: hanya `TaxRuleVersionService` yang menulis (lewat `forceFill`/
 * `forceCreate`) setelah validasi tumpang-tindih dan guard faktor DPP (Requirement 2.2, 2.7).
 */
class TaxRuleVersion extends Model {
    use DataTable, HasUlids;

    public const STATUS_DRAFT          = 'draft';
    public const STATUS_ACTIVE         = 'active';
    public const STATUS_RETIRED        = 'retired';
    public const ROUNDING_PER_LINE     = 'per_line';
    public const ROUNDING_PER_DOCUMENT = 'per_document';

    /** @var list<string> */
    public const ROUNDING_MODES = [self::ROUNDING_PER_LINE, self::ROUNDING_PER_DOCUMENT];

    public const DEFAULT_OUTPUT_ROLE = 'tax_output';
    public const DEFAULT_INPUT_ROLE  = 'tax_input';

    /**
     * Faktor DPP yang dihitung kolom generated dokumen invoice selama Bagian B belum aktif (F-17): 11/12.
     */
    public const LEGACY_DPP_NUMERATOR = 11;

    public const LEGACY_DPP_DENOMINATOR = 12;

    /** @var list<string> */
    protected $guarded = ['*'];

    public string $translateKey = 'finances.taxRuleVersion';
    protected $casts            = [
        'effective_from' => 'date',
        'effective_to'   => 'date',
        // Sama di SQLite (test) dan MySQL `decimal(9,4)`: selalu string "11.0000", bukan "11" atau float.
        'rate'            => 'decimal:4',
        'version'         => 'integer',
        'dpp_numerator'   => 'integer',
        'dpp_denominator' => 'integer',
    ];

    /**
     * Izin Requirement 13.3: `select`, `read`, `write`, `manage_rule_versions`.
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
        return ['manage_rule_versions'];
    }

    protected $configColumns = [
        'version' => [
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
        'rate' => [
            'order' => 3,
            'type'  => 'numeric',
            'show'  => true,
        ],
        'status' => [
            'order'      => 4,
            'show'       => true,
            'valueTrans' => 'finances.taxRuleVersion.columns.status.options',
            'groupable'  => true,
        ],
        'tax_id' => [
            'ignore' => true,
        ],
        'created_by_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':version';
    }

    /**
     * Lookup generik (`ModelController`) wajib memeriksa izin `select`: aturan pajak bukan data master umum yang
     * boleh dilihat setiap pengguna lewat LinkModel.
     */
    public static function lookupRequiresSelectPermission(): bool {
        return true;
    }

    /**
     * Hanya versi `draft` yang boleh dihapus (versi aktif/pensiun adalah riwayat aturan).
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

    /** Faktor DPP sebagai bilangan bulat pembilang/penyebut, mis. `11/12`; `1/1` berarti basis penuh. */
    public function dppFactorLabel(): string {
        return $this->dpp_numerator . '/' . $this->dpp_denominator;
    }

    public function tax(): BelongsTo {
        return $this->belongsTo(Tax::class, 'tax_id');
    }

    public function createdBy(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}
