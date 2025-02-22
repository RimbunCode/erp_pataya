<?php

namespace App\Models\Core;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model {
  use HasUlids, DataTable, SoftDeletes;

  protected $guarded = ['id'];
  protected $casts = [
    'is_main_branch' => 'boolean',
    'is_disabled' => 'boolean',
  ];
}
