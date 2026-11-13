<?php

namespace App\Models\Finances;

use App\Models\Inventory\Category;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aturan akun bersyarat pada Posting Profile (Finance Fase 2, Requirement 12.1): (jenis dokumen, varian, atribut
 * barang) => akun untuk satu peran. Kondisi null berarti tidak dibatasi. Spesifisitas aturan = jumlah kondisi
 * non-null; pemilihan oleh `AccountRuleMatcher`.
 *
 * Tidak memakai `DataTable` (pola `JournalVoucherItem`): kolomnya didefinisikan di namespace lang profil induk.
 */
class PostingProfileRule extends Model {
    use HasUlids;

    public static $parentRelation = 'postingProfile';
    public string $translateKey   = 'finances.postingProfile';
    protected $guarded            = ['*'];
    protected $casts              = [
        'is_stock_item' => 'boolean',
        'priority'      => 'integer',
    ];
    protected array $configColumns = [
        'document_type' => [
            'order' => 0,
            'show'  => true,
        ],
        'variant' => [
            'order' => 1,
            'show'  => true,
        ],
        'role' => [
            'order' => 2,
            'show'  => true,
        ],
        'item_type' => [
            'order' => 3,
            'show'  => true,
        ],
        'is_stock_item' => [
            'order' => 4,
            'show'  => true,
        ],
        'itemCategory' => [
            'type'  => 'relation',
            'order' => 5,
            'show'  => true,
        ],
        'account' => [
            'type'  => 'relation',
            'order' => 6,
            'show'  => true,
        ],
        'priority' => [
            'order' => 7,
            'show'  => true,
        ],
        'posting_profile_id' => [
            'ignore' => true,
        ],
        'item_category_id' => [
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

    public function itemCategory(): BelongsTo {
        return $this->belongsTo(Category::class, 'item_category_id');
    }

    /**
     * Jumlah kondisi non-null: ukuran spesifisitas aturan (Requirement 12.2).
     */
    public function specificity(): int {
        return \count(array_filter([
            $this->document_type,
            $this->variant,
            $this->item_type,
            $this->is_stock_item,
            $this->item_category_id,
        ], static fn ($value) => $value !== null));
    }

    /**
     * Lookup generik (`ModelController`) wajib memeriksa izin: label akun dan nama profil tidak boleh bocor lewat
     * lookup model anak. Model ini tidak punya entri izin sendiri, jadi mengikuti izin `select` `PostingProfile`.
     */
    public static function lookupRequiresSelectPermission(): bool {
        return true;
    }

    /**
     * @return class-string
     */
    public static function lookupPermissionModel(): string {
        return PostingProfile::class;
    }
}
