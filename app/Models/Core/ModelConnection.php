<?php

namespace App\Models\Core;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ModelConnection extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = [
    "id"
  ];

  public function model() {
    return $this->morphTo();
  }
  public function reference() {
    return $this->morphTo();
  }
}
