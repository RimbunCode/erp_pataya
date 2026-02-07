<?php

namespace App\Models\Inventory;

use App\Models\Finances\Account;
use App\Models\Finances\AdditionalCost;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntry extends Model {
  use HasUlids, SoftDeletes, DataTable, Submitable;
  protected               $guarded           = ["id"];
  protected               $casts             = [
    'date'          => 'datetime',
    'received_date' => 'datetime',
    'using_transit' => 'boolean',
  ];
  public string           $keyBreadcrumb     = "code";
  protected static string $defaultFormatCode = 'StockEntry-@[iiii]/@[yy]';

  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name',
    ];
  }
  public string $translateKey  = 'inventory.stockEntry';
  protected     $configColumns = [
    'code'   => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'date'   => [
      'show'  => true,
      'order' => 1,
    ],
    'type'   => [
      'show'       => true,
      'order'      => 2,
      'valueTrans' => 'inventory.stockEntry.types',
    ],
    'status' => [
      'show'  => true,
      'order' => 3,
    ],
    'branch' => [
      'ignore' => true,
    ],
    'items',
    'additionalCosts',
    'differenceAccount',
    'referenceable',
  ];

  protected static function loadRelationsOnShow() {
    return [
      'items',
      'items.item',
      'items.unit',
      'items.sourceWarehouse',
      'items.targetWarehouse',
      'referenceable',
      'additionalCosts',
      'differenceAccount',
    ];
  }

  public function differenceAccount() {
    return $this->belongsTo(Account::class, 'difference_account_id');
  }

  public function items() {
    return $this->hasMany(StockEntryItem::class);
  }

  public function additionalCosts() {
    return $this->morphMany(AdditionalCost::class, 'referenceable');
  }

  public function referenceable() {
    return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
  }
}
