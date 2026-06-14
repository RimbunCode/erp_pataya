<?php

namespace App\Models\Purchase;

use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrderItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'purchaseOrder';
    public string $translateKey   = 'purchase.purchaseOrder.item';
    protected $guarded            = ['id'];
    protected $casts              = [
        'required_date' => 'datetime',
    ];
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
        'rate' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 3,
        ],
        'basic_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 4,
        ],
        'tax' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 5,
        ],
        'tax_rate' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 6,
        ],
        'tax_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 7,
        ],
        'amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 8,
        ],
        'targetWarehouse' => [
            'type'  => 'relation',
            'show'  => false,
            'order' => 9,
        ],
        'description' => [
            'show'  => false,
            'order' => 10,
        ],
        'required_date' => [
            'type'  => 'date',
            'show'  => false,
            'order' => 11,
        ],
        'received_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 12,
        ],
        'unreceived_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 13,
        ],
        'billed_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 14,
        ],
        'unbilled_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 15,
        ],
        'conversion_factor' => [
            'ignore' => true,
        ],
        'item_name' => [
            'ignore' => true,
        ],
        'unit_name' => [
            'ignore' => true,
        ],
        'purchaseOrder' => [
            'ignore' => true,
        ],
        'purchase_order_id' => [
            'ignore' => true,
        ],
        'referenceable' => [
            'ignore' => true,
        ],
    ];

    public function purchaseOrder() {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }

    public function targetWarehouse() {
        return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function referenceable() {
        return $this->morphTo();
    }

    public function parentItem() {
        return $this->belongsTo(PurchaseOrderItem::class, 'parent_item_id');
    }

    public function childItems() {
        return $this->hasMany(PurchaseOrderItem::class, 'parent_item_id');
    }
}
