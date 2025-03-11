<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockAttribute extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
}
