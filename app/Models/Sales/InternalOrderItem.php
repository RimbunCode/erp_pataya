<?php

namespace App\Models\Sales;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class InternalOrderItem extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ['id'];

  public static function templateLink() {
    return ":item";
  }

  public function internalOrder() {
    return $this->belongsTo(InternalOrder::class);
  }

  public function unit() {
    return $this->belongsTo(Unit::class);
  }

  public function sourceWarehouse() {
    return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
  }

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_id');
  }
}
