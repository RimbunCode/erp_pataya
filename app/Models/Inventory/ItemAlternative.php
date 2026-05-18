<?php

namespace App\Models\Inventory;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemAlternative extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $with       = ['item', 'alternative'];
    protected $guarded    = ['id'];
    public $keyBreadcrumb = 'item.code';
    protected $casts      = [
        'two_way' => 'boolean',
    ];

    public static function templateLink() {
        return ':item.code';
    }

    protected array $configColumns = [
        'item' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'alternative' => [
            'show'               => true,
            'order'              => 1,
            'disabledNavigation' => true,
        ],
        'two_way' => [
            'show'  => true,
            'order' => 2,
        ],
    ];
    public string $translateKey = 'inventory.itemAlternative';

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id', 'id');
    }

    public function alternative() {
        return $this->belongsTo(ItemVariant::class, 'alternative_item_id', 'id');
    }

    public string $formComponent = 'Inventory/ItemAlternatives/Form';
}
