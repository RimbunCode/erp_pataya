<?php

namespace App\Models\Inventory;

use App\Casts\FormTable;
use App\Casts\Json;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;

class Attribute extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];
  protected $casts = [
    'is_numeric' => 'boolean',
    'values' => FormTable::class,
  ];

  public static function templateLink() {
    return ":name";
  }
}
