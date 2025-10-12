<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  public static function templateLink() {
    return ':code{:title} - :name';
  }
  public $keyBreadcrumb = "title";
  protected $appends = ['title'];

  public function title(): Attribute {
    return new Attribute(
      get: function () {
        return $this->branch->code . '-' . $this->code;
      }
    );
  }

  public string $formComponent = 'Inventory/Warehouses/Form';
  public string $translateKey = "inventory.warehouse";
  protected $configColumns = [
    'title' => [
      'show' => true,
      'order' => 0,
      'isLink' => true
    ],
    'name' => [
      'show' => true,
      'order' => 1
    ],
    'pic' => [
      'show' => true,
      'order' => 2
    ]
  ];

  public function branch() {
    return $this->belongsTo(Branch::class);
  }

  public function pic() {
    return $this->belongsTo(User::class, 'user_id');
  }

  public function stocks() {
    return $this->hasMany(Stock::class);
  }
  protected static function loadRelationsOnShow() {
    return ['branch', 'pic'];
  }
}
