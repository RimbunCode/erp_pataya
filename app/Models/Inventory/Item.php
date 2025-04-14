<?php

namespace App\Models\Inventory;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  protected $casts = [
    'is_disabled' => 'boolean',
    'allow_alternative_item' => 'boolean',
  ];

  public static function templateLink() {
    return "<title>:code</title><br/><span>:name</span>";
  }

  public function attributes() {
    return $this->hasMany(ItemAttribute::class);
  }

  public function defaultUnit() {
    return $this->belongsTo(Unit::class, 'default_unit_id');
  }
  public function uom() {
    return $this->hasMany(ItemUnit::class, 'item_id', 'id');
  }
  public function category() {
    return $this->belongsTo(Category::class);
  }
  public function variants() {
    return $this->hasMany(ItemAttribute::class, 'item_id', 'id');
  }
}
