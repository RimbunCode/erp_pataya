<?php

namespace App\Models\Core;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class Branch extends Model {
  use HasUlids, DataTable;

  protected $guarded = ['id'];
}
