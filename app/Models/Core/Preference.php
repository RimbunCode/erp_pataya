<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class Preference extends Model {
  protected $guarded = ['id'];

  protected $casts = [
    'value' => \App\Casts\Json::class
  ];
}
