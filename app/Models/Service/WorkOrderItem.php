<?php

namespace App\Models\Service;

use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkOrderItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation  = 'workOrder';
    protected $guarded             = ['id'];
    public string $translateKey    = 'service.workOrder.workOrderItem';
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
        'workOrder' => [
            'ignore' => true,
        ],
    ];

    public function workOrder() {
        return $this->belongsTo(WorkOrder::class);
    }

    public function item(): mixed {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id', 'id')
            ->with(['defaultUom']);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }
}
