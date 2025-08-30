<?php

namespace App\Models\Sales;

use App\Models\Finances\Tax;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrderItem extends Model
{
  use  HasUlids, SoftDeletes;
  protected $guarded = ['id'];

  public function salesOrder()
  {
    return $this->belongsTo(SalesOrder::class);
  }

  public function unit()
  {
    return $this->belongsTo(Unit::class);
  }

  public function tax()
  {
    return $this->belongsTo(Tax::class);
  }

  public function sourceWarehouse()
  {
    return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
  }

  public function item()
  {
    return $this->belongsTo(ItemVariant::class, 'item_id');
  }
}
