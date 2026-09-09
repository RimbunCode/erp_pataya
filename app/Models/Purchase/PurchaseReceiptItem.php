<?php

namespace App\Models\Purchase;

use App\Models\Asset\Asset;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReceiptItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'purchaseReceipt';
    public string $translateKey   = 'purchase.purchaseReceipt.item';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'            => 'float',
        'conversion_factor'   => 'float',
        'returned_quantity'   => 'float',
        'unreturned_quantity' => 'float',
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

    public function asset(): HasOne {
        return $this->hasOne(Asset::class, 'purchase_receipt_item_id');
    }

    public static function templateLink() {
        return '<title>:item.code - :item.item_name</title><b>:item.code</b><br/><span>:item.item_name</span> — Qty :quantity';
    }

    /**
     * Baris untuk Item is_fixed_asset yang belum dikonversi jadi Asset —
     * dipakai LinkModel link manual Asset↔Purchase (spec
     * asset-management-purchase-integration-v2, Requirement 2).
     */
    public function scopeLinkModel(Builder $query, string $search): Builder {
        return $query
            ->whereHas('item.item', fn ($q) => $q->where('is_fixed_asset', true))
            ->whereDoesntHave('asset')
            ->when($search !== '', fn ($q) => $q->whereHas(
                'item.item',
                fn ($q2) => $q2->where('name', 'like', "%{$search}%"),
            ));
    }
}
