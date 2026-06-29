<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntryItem extends Model {
    use HasUlids;
    use SoftDeletes;

    public static $parentRelation = 'stockEntry';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'          => 'float',
        'conversion_factor' => 'float',
        'valuation_rate'    => 'float',
        'actual_quantity'   => 'float',
        'incoming_quantity' => 'float',
        'outgoing_quantity' => 'float',
        'incoming_rate'     => 'float',
    ];
    public $translateKey           = 'inventory.stockEntry.item_columns';
    protected array $configColumns = [
        'sourceWarehouse' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 0,
        ],
        'targetWarehouse' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 1,
        ],
        'item' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'quantity' => [
            'show'  => true,
            'order' => 3,
        ],
        'unit' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 4,
        ],
        'basic_rate' => [
            'type'         => 'currency',
            'decimalScale' => 2,
            'show'         => true,
            'order'        => 5,
        ],
        'stockEntry' => [
            'ignore' => true,
        ],
    ];

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id', 'id');
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function stockEntry() {
        return $this->belongsTo(StockEntry::class);
    }

    public function sourceWarehouse() {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function targetWarehouse() {
        return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
    }
}
