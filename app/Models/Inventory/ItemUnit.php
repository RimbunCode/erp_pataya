<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemUnit extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
  public function item() {
    return $this->belongsTo(Item::class);
  }
  public function unit() {
    return $this->belongsTo(Unit::class);
  }
}
