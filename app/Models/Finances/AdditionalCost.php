<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdditionalCost extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ['id'];

  public function referenceable() {
    return $this->morphTo();
  }
  public string $translateKey = 'finances.additionalCost';
}
