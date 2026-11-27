<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tax extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public const CATEGORY_UNCLASSIFIED = 'unclassified';
    public const CATEGORY_PPN_STANDARD = 'ppn_standard';
    public const CATEGORY_PPN_LUXURY   = 'ppn_luxury';
    public const CATEGORY_PPH_21       = 'pph_21';
    public const CATEGORY_PPH_22       = 'pph_22';
    public const CATEGORY_PPH_23       = 'pph_23';
    public const CATEGORY_PPH_4_2      = 'pph_4_2';
    public const CATEGORY_OTHER        = 'other';

    /**
     * Klasifikasi pajak (Finance Fase 3, Requirement 1.1). `unclassified` adalah default migration: sistem tidak
     * menebak klasifikasi, akuntan yang menetapkannya.
     *
     * @var list<string>
     */
    public const CATEGORIES = [
        self::CATEGORY_UNCLASSIFIED,
        self::CATEGORY_PPN_STANDARD,
        self::CATEGORY_PPN_LUXURY,
        self::CATEGORY_PPH_21,
        self::CATEGORY_PPH_22,
        self::CATEGORY_PPH_23,
        self::CATEGORY_PPH_4_2,
        self::CATEGORY_OTHER,
    ];

    /** Kategori PPN: tidak boleh berperilaku `withholding` (Requirement 1.3). */
    public const PPN_CATEGORIES = [self::CATEGORY_PPN_STANDARD, self::CATEGORY_PPN_LUXURY];

    public const BEHAVIOR_ADDITIVE    = 'additive';
    public const BEHAVIOR_WITHHOLDING = 'withholding';

    /** @var list<string> */
    public const BEHAVIORS = [self::BEHAVIOR_ADDITIVE, self::BEHAVIOR_WITHHOLDING];

    public const DEFAULT_JURISDICTION = 'ID';

    public string $formComponent = 'Finances/Taxes/Form';
    protected $guarded           = ['id'];
    protected $casts             = [
        'rate'          => 'float',
        'is_creditable' => 'boolean',
    ];

    public static function templateLink() {
        return ':name (:rate%)';
    }

    protected array $configColumns = [
        'name' => [
            'show'   => true,
            'isLink' => true,
        ],
        'rate' => [
            'type' => 'numeric',
            'show' => true,
        ],
        'category' => [
            'show'       => true,
            'valueTrans' => 'finances.taxes.columns.category.options',
            'groupable'  => true,
        ],
        'behavior' => [
            'show'       => true,
            'valueTrans' => 'finances.taxes.columns.behavior.options',
            'groupable'  => true,
        ],
        'jurisdiction_code' => [
            'ignore' => true,
        ],
        'is_creditable' => [
            'type' => 'boolean',
        ],
    ];
    public string $translateKey = 'finances.taxes';

    /**
     * Versi aturan berlaku-tanggal (Requirement 2). Nama relasi `ruleVersions`, bukan `versions`, agar tidak
     * bertabrakan dengan konvensi relasi riwayat model lain.
     */
    public function ruleVersions(): HasMany {
        return $this->hasMany(TaxRuleVersion::class, 'tax_id');
    }

    public function isPpn(): bool {
        return \in_array($this->category, self::PPN_CATEGORIES, true);
    }

    /** Pajak yang sudah diklasifikasi dan menambah total dokumen (kandidat pemisahan baris jurnal, Requirement 7.3). */
    public function isClassifiedAdditive(): bool {
        return $this->category !== self::CATEGORY_UNCLASSIFIED && $this->behavior === self::BEHAVIOR_ADDITIVE;
    }
}
