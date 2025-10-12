<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntryItem extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ["id"];

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_id', 'id');
  }
  public function unit() {
    return $this->belongsTo(Unit::class, 'unit_id', 'id');
  }
  public function stockEntry() {
    return $this->belongsTo(StockEntry::class);
  }
  public function sourceWarehouse() {
    return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
  }
  public function targetWarehouse() {
    return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
  }
}
