<?php

namespace App\Models\Finances;

use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseInvoiceItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'purchaseInvoice';
    public string $translateKey   = 'finances.purchaseInvoice.item';
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
        'returned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 11,
        ],
        'unreturned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 12,
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
