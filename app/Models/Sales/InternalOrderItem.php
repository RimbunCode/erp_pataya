<?php

namespace App\Models\Sales;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class InternalOrderItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation  = 'internalOrder';
    public string $translateKey    = 'sales.internalOrder.item';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'item' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 0,
        ],
        'quantity' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 1,
        ],
        'unit' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'sourceWarehouse' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 3,
        ],
        'description' => [
            'show'  => false,
            'order' => 4,
        ],
        'delivered_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 5,
        ],
        'undelivered_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 6,
        ],
        'conversion_factor' => [
            'hidden'   => true,
            'linkable' => true,
        ],
        'internalOrder' => [
            'ignore' => true,
        ],
        'internal_order_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':item';
    }

    public function internalOrder() {
        return $this->belongsTo(InternalOrder::class);
    }

    public function unit() {
        return $this->belongsTo(Unit::class);
    }

    public function sourceWarehouse() {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }
}
