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
  public string $translateKey = "inventory.category";
  protected $configColumns = [
    'name' => [
      'isLink' => true,
      'show' => true,
      'order' => 0,
    ],
    'type' => [
      'show' => true,
      'order' => 1,
      'valueTrans' => 'inventory.category.types'
    ]
  ];
}
