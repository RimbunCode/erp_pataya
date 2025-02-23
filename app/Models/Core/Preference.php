<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class Preference extends Model {
  protected $primaryKey = 'key';
  public $incrementing = false;
  protected $keyType = 'string';
  protected $guarded = [];
  protected $casts = [
    'value' => \App\Casts\Json::class
  ];
}
