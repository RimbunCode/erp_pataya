<?php

namespace App\Models\Purchase;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequest extends Model {
  use HasUlids, SoftDeletes, DataTable, Submitable;

  protected $guarded = ["id"];
  protected $casts = [
    "date" => "datetime",
    'required_date' => 'datetime'
  ];
  protected static string $defaultFormatCode = '@[branch_code]/PR-@[iiii]/@[yy]';
  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name'
    ];
  }
  public $keyBreadcrumb = "code";
  public string $formComponent = 'Purchase/PurchaseRequests/Form';
  protected $configColumns = [
    "code" => [
      "show" => true,
      "isLink" => true,
      "order" => 0,
    ],
    'date' => [
      'show' => true,
      "order" => 1,
    ],
    'required_date' => [
      'show' => true,
      "order" => 2,
    ],
    'status' => [
      'show' => true,
      "order" => 3,
    ],
    'items',
  ];
  protected static function loadRelationsOnShow() {
    return [
      'items',
      'items.item',
      'items.unit',
    ];
  }
  public function items() {
    return $this->hasMany(PurchaseRequestItem::class);
  }

  public string $translateKey = "purchase.purchaseRequest";
  // protected static function loadRelationsOnShow() {
  //   return ['items', 'items.item', 'customer', 'customer_branch', 'item_service', 'source_warehouse'];
  // }

}
