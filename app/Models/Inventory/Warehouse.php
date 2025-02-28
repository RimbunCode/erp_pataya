<?php

namespace App\Models\Inventory;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];
}
