<?php

namespace App\Models\Service;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkOrderItem extends Model
{
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public string $translateKey = 'service.workOrder.workOrderItem';

    protected $configColumns = [
        'workOrder' => [
            'show' => true,
            'order' => 0,
        ],
        'item' => [
            'show' => true,
            'order' => 1,
        ],
        'quantity' => [
            'show' => true,
            'order' => 2,
        ],
        'unit' => [
            'show' => true,
            'order' => 3,
        ],
    ];

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function parentRelation()
    {
        return $this->workOrder();
    }

    public function item(): mixed
    {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id', 'id')
            ->with(['defaultUnit']);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class, 'unit_id', 'id');
    }
}
