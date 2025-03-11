<?php

namespace App\Models\Inventory;

use App\Casts\FormTable;
use App\Casts\Json;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attribute extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];
  protected $casts = [
    'is_numeric' => 'boolean',
    'values' => FormTable::class,
  ];
}
