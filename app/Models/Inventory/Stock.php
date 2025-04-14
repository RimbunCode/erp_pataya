<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stock extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];

  public function warehouse() {
    return $this->belongsTo(Warehouse::class);
  }
  public function itemVariant() {
    return $this->belongsTo(ItemVariant::class);
  }
  public function unit() {
    return $this->belongsTo(Unit::class);
  }
}
