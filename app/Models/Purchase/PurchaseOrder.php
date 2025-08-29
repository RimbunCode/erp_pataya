<?php

namespace App\Models\Purchase;

use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model {
  use HasUlids, SoftDeletes, DataTable, Submitable;

  protected $guarded = ["id"];
  protected $casts = [
    "date" => "datetime",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/PO-@[iiii]/@[yy]';
  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name'
    ];
  }
  public $keyBreadcrumb = "code";
  public string $formComponent = 'Purchase/PurchaseOrders/Form';

  // protected static function loadRelationsOnShow() {
  //   return ['items', 'items.item', 'customer', 'customer_branch', 'item_service', 'source_warehouse'];
  // }
}
