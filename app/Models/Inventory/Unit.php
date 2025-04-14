<?php

namespace App\Models\Inventory;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Unit extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  protected $casts = [
    'is_default' => 'boolean'
  ];

  public static function templateLink() {
    return ":name</title><br/><span class='text-muted-foreground'>:code</span>";
  }
}
