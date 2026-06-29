<?php

namespace App\Models\Sales;

use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNoteItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'deliveryNote';
    public string $translateKey   = 'sales.deliveryNote.item';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'          => 'float',
        'conversion_factor' => 'float',
        'unit_price'        => 'float',
        'subtotal'          => 'float',
    ];

    public static function templateLink() {
        return ':item';
    }

    public function deliveryNote() {
        return $this->belongsTo(DeliveryNote::class);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id');
    }

    public function sourceWarehouse() {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }
}
