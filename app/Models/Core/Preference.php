<?php

namespace App\Models\Core;

use App\Traits\DataTable;
use App\Models\Model;

class Preference extends Model {
  use DataTable;
  protected $primaryKey = 'key';
  public $incrementing = false;
  protected $keyType = 'string';
  protected $guarded = [];
  protected $casts = [
    'value' => \App\Casts\Json::class
  ];
}
