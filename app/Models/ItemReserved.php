<?php

namespace App\Models;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemReserved extends Model {
  use HasUlids, SoftDeletes;

  protected $guarded = ["id"];
}
