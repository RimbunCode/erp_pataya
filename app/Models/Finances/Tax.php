<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tax extends Model
{
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  public static function templateLink()
  {
    return ":name (:rate%)";
  }
}
