<?php

namespace App\Models\Purchase;

use App\Models\Core\Currency;
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
  public string $translateKey = "purchase.purchaseOrder";

  public $configColumns = [
    'code' => [
      'isLink' => true,
      'show' => true,
      'order' => 0,
    ],
    'date' => [
      'show' => true,
      'order' => 1,
    ],
    'supplier' => [
      'show' => true,
      'order' => 2,
    ],
    'status' => [
      'show' => true,
      'order' => 3,
    ],

  ];
  protected static function loadRelationsOnShow() {
    return ['items', 'items.item', 'supplier', 'items.unit'];
  }

  public function currency() {
    return $this->belongsTo(Currency::class);
  }
  public function supplier() {
    return $this->belongsTo(Supplier::class);
  }
  public function items() {
    return $this->hasMany(PurchaseOrderItem::class);
  }
}
