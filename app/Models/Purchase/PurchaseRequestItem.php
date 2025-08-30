<?php

namespace App\Models\Purchase;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequestItem extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];

  protected $configColumns = [
    'purchaseRequest'
  ];

  public function purchaseRequest() {
    return $this->belongsTo(PurchaseRequest::class);
  }

  public function referenceable() {
    return $this->morphTo();
  }
}
