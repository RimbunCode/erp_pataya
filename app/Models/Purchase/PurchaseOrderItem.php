<?php

namespace App\Models\Purchase;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrderItem extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];

  public function referenceable() {
    return $this->morphTo();
  }
}
