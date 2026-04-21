<?php

namespace App\Models\Purchase;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReceiptItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'purchaseReceipt';
    protected $guarded            = ['id'];

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
        return $this->belongsTo(Unit::class);
    }

    public function targetWarehouse() {
        return $this->belongsTo(Warehouse::class);
    }

    public function returnAgainstItem() {
        return $this->belongsTo(PurchaseReceiptItem::class, 'return_against_item_id');
    }
}
