<?php

namespace App\Models\Core;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];
}
