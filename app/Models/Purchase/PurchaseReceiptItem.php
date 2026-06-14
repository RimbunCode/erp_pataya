<?php

namespace App\Models\Purchase;

use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReceiptItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation  = 'purchaseReceipt';
    public string $translateKey    = 'purchase.purchaseReceipt.item';
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
        'targetWarehouse' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 3,
        ],
        'description' => [
            'show'  => false,
            'order' => 4,
        ],
        'purchaseReceipt' => [
            'ignore' => true,
        ],
        'purchase_receipt_id' => [
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
    ];

    public function purchaseReceipt() {
        return $this->belongsTo(PurchaseReceipt::class, 'purchase_receipt_id');
    }

    public function purchaseOrderItem() {
        return $this->belongsTo(PurchaseOrderItem::class, 'purchase_order_item_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function targetWarehouse() {
        return $this->belongsTo(Warehouse::class);
    }

    public function returnAgainstItem() {
        return $this->belongsTo(PurchaseReceiptItem::class, 'return_against_item_id');
    }
}
