<?php

namespace App\Models\Inventory;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemAlternative extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $with = ['item', 'alternative'];
  protected $guarded = ['id'];
  public $keyBreadcrumb = 'item.code';
  protected $casts = [
    'two_way' => 'boolean',
  ];
  public static function templateLink() {
    return ":item.code";
  }

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_id', 'id');
  }
  public function alternative() {
    return $this->belongsTo(ItemVariant::class, 'alternative_item_id', 'id');
  }
}
