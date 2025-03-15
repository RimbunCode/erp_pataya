<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stock extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ['id'];
}
