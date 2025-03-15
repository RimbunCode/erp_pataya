<?php

namespace App\Models\Core;

use App\Models\Model;

class Country extends Model {
  protected $primaryKey = 'code';
  public $incrementing = false;
  protected $keyType = 'string';
  protected $guarded = [];
}
