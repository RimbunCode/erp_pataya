<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemBarcode extends Model {
    use HasUlids, SoftDeletes;
    public string $translateKey  = 'inventories.itemBarcode';
    protected     $guarded       = ['id'];
    protected     $with          = ['basicUnit', 'unit'];
    protected     $configColumns = [
        'barcode',
        'item',
        'unit',
    ];

    public static function templateLink() {
        return '<title>:barcode - :item.code/:item.item_name</title><b>:barcode</b><br/><b>(:item.code) :item.item_name</b><br/><span>1 :unit.name</span>';
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id', 'id');
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function basicUnit() {
        return $this->belongsTo(Unit::class, 'unit_id', 'id');
    }
}
