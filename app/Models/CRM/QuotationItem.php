<?php

namespace App\Models\CRM;

use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class QuotationItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'quotation';
    public string $translateKey   = 'crm.quotation.item';
    protected $guarded            = ['id', 'amount'];
    protected $casts              = [
        'quantity' => 'float',
        'price'    => 'float',
        'amount'   => 'float',
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
        'price' => [
            'show'  => true,
            'order' => 3,
        ],
        'amount' => [
            'show'  => true,
            'order' => 4,
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
}
