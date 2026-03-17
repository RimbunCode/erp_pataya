<?php

namespace App\Models\Purchase;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequestItem extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded       = ['id'];
    protected $configColumns = [
        'purchaseRequest',
    ];
    protected $casts = [
        'required_date' => 'datetime',
    ];

    public function purchaseRequest() {
        return $this->belongsTo(PurchaseRequest::class);
    }

    public function parentRelation() {
        return $this->purchaseRequest();
    }

    public function referenceable() {
        return $this->morphTo();
    }

    public function item(): mixed {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id', 'id')->withTrashed($this->status != 'draft')
            ->with(['defaultUnit' => function ($q) {
                return $q->withTrashed($this->status != 'draft');
            }]);
    }

    public function unit() {
        return $this->belongsTo(Unit::class, 'unit_id', 'id')->withTrashed($this->status != 'draft');
    }
}
