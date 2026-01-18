<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemVariantAttribute extends Model {
  use HasUlids, SoftDeletes;
  protected     $guarded       = ['id'];
  public string $translateKey  = 'inventories.itemVariantAttributes';
  protected     $configColumns = [
    'attribute_name' => [
      'show'    => true,
      'order=>' => 0,
    ],
    'attribute',
    'barcode',
    'item',
  ];

  public function barcode() {
    return $this->hasMany(ItemBarcode::class, 'item_id', 'id');
  }

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_id', 'id');
  }

  public function attribute() {
    return $this->belongsTo(Attribute::class, 'attribute_id', 'id');
  }
}
