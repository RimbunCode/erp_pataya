<?php

namespace App\Models\Inventory;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  public static function templateLink() {
    return ":name";
  }

  public string $formComponent = 'Inventory/Categories/Form';
}
