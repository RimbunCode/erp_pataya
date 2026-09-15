<?php

namespace App\Models\Inventory;

use App\Enums\Permission;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntryItem extends Model {
    use HasUlids;
    use SoftDeletes;

    /** Izin lihat rate/HPP stock entry: pembuat StockEntry. */
    private const RATE_VISIBILITY = [
        [StockEntry::class, [Permission::Write, Permission::Create]],
    ];

    public static $parentRelation = 'stockEntry';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'          => 'float',
        'conversion_factor' => 'float',
        'basic_rate'        => 'float',
        'additional_cost'   => 'float',
        'valuation_rate'    => 'float',
        'basic_amount'      => 'float',
        'amount'            => 'float',
    ];
    public $translateKey = 'inventory.stockEntry.item_columns';

    public static function templateLink() {
        return ':item';
    }

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
            'visibleFor'   => self::RATE_VISIBILITY,
        ],
        'additional_cost' => [
            'type'         => 'currency',
            'decimalScale' => 2,
            'show'         => true,
            'order'        => 6,
            'visibleFor'   => self::RATE_VISIBILITY,
        ],
        'valuation_rate' => [
            'type'         => 'currency',
            'decimalScale' => 2,
            'show'         => true,
            'order'        => 7,
            'visibleFor'   => self::RATE_VISIBILITY,
        ],
        'basic_amount' => [
            'type'         => 'currency',
            'decimalScale' => 2,
            'show'         => true,
            'order'        => 8,
            'visibleFor'   => self::RATE_VISIBILITY,
        ],
        'amount' => [
            'type'         => 'currency',
            'decimalScale' => 2,
            'show'         => true,
            'order'        => 9,
            'visibleFor'   => self::RATE_VISIBILITY,
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
