<?php

namespace App\Models\Finances;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseInvoiceItem extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ['id'];
  protected $casts   = [
    "required_date" => "datetime",
  ];

  // protected $configColumns =[

  // ]

  public function purchaseInvoice() {
    return $this->belongsTo(PurchaseInvoice::class);
  }

  public function unit() {
    return $this->belongsTo(Unit::class);
  }

  public function tax() {
    return $this->belongsTo(Tax::class);
  }

  public function targetWarehouse() {
    return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
  }

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_id');
  }

  public function referenceable() {
    return $this->morphTo();
  }
}
