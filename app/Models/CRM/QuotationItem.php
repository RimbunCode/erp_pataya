<?php

namespace App\Models\CRM;

use App\Enums\Permission;
use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class QuotationItem extends Model {
    use HasUlids, SoftDeletes;

    /** Izin lihat harga jual: pembuat Quotation. */
    private const PRICE_VISIBILITY = [
        [Quotation::class, [Permission::Write, Permission::Create]],
    ];

    public static $parentRelation = 'quotation';
    public string $translateKey   = 'crm.quotation.item';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'     => 'float',
        'price'        => 'float',
        'tax_rate'     => 'float',
        'basic_amount' => 'float',
        'tax_amount'   => 'float',
        'amount'       => 'float',
    ];
    protected array $configColumns = [
        'item' => [
            'show'  => true,
            'order' => 0,
        ],
        'description' => [
            'show'  => true,
            'order' => 1,
        ],
        'quantity' => [
            'show'  => true,
            'order' => 2,
        ],
        'remark' => [
            'show'  => false,
            'order' => 2,
        ],
        'itemUnit' => [
            'type'  => 'relation',
            'show'  => false,
            'order' => 2,
        ],
        'tax' => [
            'type'  => 'relation',
            'show'  => false,
            'order' => 5,
        ],
        'price' => [
            'show'       => true,
            'order'      => 3,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        // basic_amount dan tax_amount dapat dipakai menghitung balik harga satuan
        // (basic_amount / quantity), jadi wajib memakai izin yang sama dengan price.
        'basic_amount' => [
            'show'       => false,
            'order'      => 4,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'tax_amount' => [
            'show'       => false,
            'order'      => 5,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'amount' => [
            'show'       => true,
            'order'      => 6,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
    ];

    public static function templateLink() {
        return ':item';
    }

    public function quotation() {
        return $this->belongsTo(Quotation::class);
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function itemUnit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id');
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }
}
