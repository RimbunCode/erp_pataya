<?php

namespace App\Models\Inventory;

use App\Casts\Json;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemAttribute extends Model {
  use HasUlids, SoftDeletes;
  protected $table = 'item_attributes';
  protected $guarded = ['id'];
  protected $casts = [
    'values' => Json::class,
  ];

  public function item() {
    return $this->belongsTo(Item::class);
  }
  public function attribute() {
    return $this->belongsTo(Attribute::class);
  }
}
