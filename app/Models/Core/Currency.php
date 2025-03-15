<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Concerns\HasUniqueStringIds;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;

class Currency extends Model {
  protected $primaryKey = 'code';
  public $incrementing = false;
  protected $keyType = 'string';
  protected $guarded = [];
}
