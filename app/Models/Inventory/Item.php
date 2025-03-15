<?php

namespace App\Models\Inventory;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  public function attributes() {
    return $this->hasMany(ItemAttribute::class);
  }

  public function defaultUnit() {
    return $this->belongsTo(ItemUnit::class, 'default_unit_id');
  }
  public function category() {
    return $this->belongsTo(Category::class);
  }
}
