<?php

namespace App\Models\Finances;

use App\Enums\Permission;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseInvoiceItem extends Model {
    use HasUlids, SoftDeletes;

    /** Izin lihat kolom harga beli: pembuat PurchaseOrder atau PurchaseInvoice. */
    private const PRICE_VISIBILITY = [
        [PurchaseOrder::class, [Permission::Write, Permission::Create]],
        [PurchaseInvoice::class, [Permission::Write, Permission::Create]],
    ];

    public static $parentRelation = 'purchaseInvoice';
    public string $translateKey   = 'finances.purchaseInvoice.item';
    protected $guarded            = ['id'];
    protected $casts              = [
        'allocated_qty'       => 'float',
        'quantity'            => 'float',
        'returned_quantity'   => 'float',
        'unreturned_quantity' => 'float',
        'conversion_factor'   => 'float',
        'tax_rate'            => 'float',
        'basic_amount'        => 'float',
        'discount_amount'     => 'float',
        'dpp_amount'          => 'float',
        'tax_amount'          => 'float',
        'amount'              => 'float',
        'rate'                => 'float',
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
        'dpp_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 5,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'tax' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 6,
        ],
        'tax_rate' => [
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 7,
            'linkable' => true,
        ],
        'tax_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 8,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 9,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'targetWarehouse' => [
            'type'  => 'relation',
            'show'  => false,
            'order' => 10,
        ],
        'description' => [
            'show'  => false,
            'order' => 11,
        ],
        'returned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 12,
        ],
        'unreturned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 13,
        ],
        'conversion_factor' => [
            'hidden'   => true,
            'linkable' => true,
        ],
        'item_name' => [
            'ignore' => true,
        ],
        'unit_name' => [
            'ignore' => true,
        ],
        'purchaseInvoice' => [
            'ignore' => true,
        ],
        'purchase_invoice_id' => [
            'ignore' => true,
        ],
        'purchaseOrderItem' => [
            'ignore' => true,
        ],
        'purchase_order_item_id' => [
            'ignore' => true,
        ],
        'returnAgainstItem' => [
            'ignore' => true,
        ],
        'return_against_item_id' => [
            'ignore' => true,
        ],
        'referenceable' => [
            'ignore' => true,
        ],
    ];

    public function purchaseInvoice() {
        return $this->belongsTo(PurchaseInvoice::class);
    }

    public function purchaseOrderItem() {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function returnAgainstItem() {
        return $this->belongsTo(PurchaseInvoiceItem::class, 'return_against_item_id');
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
}
