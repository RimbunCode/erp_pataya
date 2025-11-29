<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class GeneralLedger extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ['id'];
}
