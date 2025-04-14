<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemVariantAttribute extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];

  public function barcodes() {
    return $this->hasMany(ItemBarcode::class, 'item_id', 'id');
  }
}
