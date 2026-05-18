<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntryItem extends Model {
    use HasUlids;
    use SoftDeletes;

    public static $parentRelation  = 'stockEntry';
    protected $guarded             = ['id'];
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
            'type'  => 'numeric',
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
