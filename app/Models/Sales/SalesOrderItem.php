<?php

namespace App\Models\Sales;

use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrderItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'salesOrder';
    public string $translateKey   = 'sales.salesOrder.item';
    protected $guarded            = [
        'id',
        'remaining_quantity',
        'basic_amount',
        'tax_amount',
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
        'price' => [
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
        'description' => [
            'show'  => false,
            'order' => 9,
        ],
        'sourceWarehouse' => [
            'type'  => 'relation',
            'show'  => false,
            'order' => 10,
        ],
        'delivered_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 11,
        ],
        'undelivered_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 12,
        ],
        'billed_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 13,
        ],
        'unbilled_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 14,
        ],
        'conversion_factor' => [
            'ignore' => true,
        ],
        'currency_code' => [
            'ignore' => true,
        ],
        'base_currency_code' => [
            'ignore' => true,
        ],
        'exchange_rate' => [
            'ignore' => true,
        ],
        'price_base_currency' => [
            'ignore' => true,
        ],
        'basic_amount_base_currency' => [
            'ignore' => true,
        ],
        'tax_amount_base_currency' => [
            'ignore' => true,
        ],
        'amount_base_currency' => [
            'ignore' => true,
        ],
        'salesOrder' => [
            'ignore' => true,
        ],
        'sales_order_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':item';
    }

    public function salesOrder() {
        return $this->belongsTo(SalesOrder::class);
    }

    public function parentItem() {
        return $this->belongsTo(self::class, 'parent_item_id');
    }

    public function childItems() {
        return $this->hasMany(self::class, 'parent_item_id');
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }

    public function sourceWarehouse() {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }
}
