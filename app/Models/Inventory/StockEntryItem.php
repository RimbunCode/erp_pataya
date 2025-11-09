<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntryItem extends Model {
  use HasUlids;
  use SoftDeletes;
  protected $guarded       = ["id"];
  public    $translateKey  = 'inventory.stockEntry.columns.items';
  protected $configColumns = [
    'sourceWarehouse' => [
      'show'  => true,
      'order' => 0,
    ],
    'targetWarehouse' => [
      'show'  => true,
      'order' => 1,
    ],
    'item'            => [
      'show'  => true,
      'order' => 2,
    ],
    'quantity'        => [
      'show'  => true,
      'order' => 3,
    ],
    'unit'            => [
      'show'  => true,
      'order' => 4,
    ],
  ];

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
