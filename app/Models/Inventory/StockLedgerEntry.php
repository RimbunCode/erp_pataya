<?php

namespace App\Models\Inventory;

use App\Models\Core\FormatingSeries;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockLedgerEntry extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded       = ['id'];
    public $translateKey     = 'inventory.stockLedger';
    protected $configColumns = [
        'item' => [
            'show'  => true,
            'order' => 0,
        ],
        'quantity_change' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 1,
        ],
        'quantity_after_transaction' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 2,
        ],
        'valuation_rate' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 3,
        ],
        'balance_stock_value' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 4,
        ],
        'change_in_stock_value' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 5,
        ],
        'referenceable' => [
            'show'  => true,
            'order' => 6,
        ],
        'stock_queue' => [
            'ignore' => true,
        ],

        'unit',
        'warehouse',
    ];
    protected $casts = [
        'stock_queue' => 'array',
    ];

    public function canDelete() {
        return false;
    }

    protected static string $defaultFormatCode = 'StockLedger-@[iiii]/@[yy]';
    protected static $generateCodeSeries       = true;

    public static function boot() {
        parent::boot();
        self::creating(function ($model) {
            $model->code = FormatingSeries::generate(StockEntry::class, $model->toArray());
        });
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function unit() {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function warehouse() {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function referenceable() {
        return $this->morphTo();
    }
}
