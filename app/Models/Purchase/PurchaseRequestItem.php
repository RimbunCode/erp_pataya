<?php

namespace App\Models\Purchase;

use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequestItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation  = 'purchaseRequest';
    public string $translateKey    = 'purchase.purchaseRequest.item';
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
        'required_date' => [
            'type'  => 'date',
            'show'  => true,
            'order' => 3,
        ],
        'description' => [
            'show'  => false,
            'order' => 4,
        ],
        'purchaseRequest' => [
            'ignore' => true,
        ],
        'purchase_request_id' => [
            'ignore' => true,
        ],
        'referenceable' => [
            'ignore' => true,
        ],
    ];
    protected $casts = [
        'required_date' => 'datetime',
    ];

    public function purchaseRequest() {
        return $this->belongsTo(PurchaseRequest::class);
    }

    public function referenceable() {
        return $this->morphTo();
    }

    public function item(): mixed {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id', 'id')->withTrashed($this->status != 'draft')
            ->with(['defaultUom']);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id')->withTrashed($this->status != 'draft');
    }
}
