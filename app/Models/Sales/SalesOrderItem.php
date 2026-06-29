<?php

namespace App\Models\Sales;

use App\Enums\Permission;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrderItem extends Model {
    use HasUlids, SoftDeletes;

    /** Izin lihat kolom harga jual: pembuat SalesOrder atau SalesInvoice. */
    private const PRICE_VISIBILITY = [
        [SalesOrder::class, [Permission::Write, Permission::Create]],
        [SalesInvoice::class, [Permission::Write, Permission::Create]],
    ];

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
            'show'  => true,
            'order' => 0,
        ],
        'quantity' => [
            'type'     => 'numeric',
            'show'     => true,
            'order'    => 1,
            'linkable' => true,
        ],
        'unit' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'price' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 3,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'basic_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 4,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'tax' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 5,
        ],
        'tax_rate' => [
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 6,
            'linkable' => true,
        ],
        'tax_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 7,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 8,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'description' => [
            'show'     => false,
            'order'    => 9,
            'linkable' => true,
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
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 12,
            'linkable' => true,
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
            'hidden'   => true,
            'linkable' => true,
        ],
        'currency_code' => [
            'hidden' => true,
        ],
        'base_currency_code' => [
            'hidden' => true,
        ],
        'exchange_rate' => [
            'hidden' => true,
        ],
        'price_base_currency' => [
            'hidden' => true,
        ],
        'basic_amount_base_currency' => [
            'hidden' => true,
        ],
        'tax_amount_base_currency' => [
            'hidden' => true,
        ],
        'amount_base_currency' => [
            'hidden' => true,
        ],
        'salesOrder' => [
            'ignore' => true,
        ],
        'sales_order_id' => [
            'hidden' => true,
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
