<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemBarcode extends Model {
  use SoftDeletes, HasUlids;

  protected $guarded = ['id'];

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_variant_id', 'id');
  }
  public function unit() {
    return $this->belongsTo(Unit::class, 'unit_id', 'id');
  }
}
