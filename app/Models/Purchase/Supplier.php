<?php

namespace App\Models\Purchase;

use App\Casts\FormTable;
use App\Casts\Json;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  protected $casts = [
    'is_disabled' => 'boolean',
    'banks' => FormTable::class
  ];
}
