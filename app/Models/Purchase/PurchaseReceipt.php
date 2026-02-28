<?php

namespace App\Models\Purchase;

use App\Models\Finances\PaymentSchedule;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReceipt extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected               $guarded           = ['id'];
  protected               $casts             = [
    "received_date" => "datetime",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/Receipt-@[iiii]/@[yy]';

  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name',
    ];
  }
  public $keyBreadcrumb = "code";

  public static function templateLink() {
    return ":code";
  }
  public $translateKey = 'purchase.purchaseReceipt';

  protected static function loadRelationsOnShow() {
    return ['items', 'items.item', 'supplier', 'items.unit', 'items.targetWarehouse', 'purchaseOrder', 'returnAgainst'];
  }
  protected $configColumns = [
    'code'          => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'received_date' => [
      'show'  => true,
      'order' => 1,
    ],
    'purchaseOrder' => [
      'show'  => true,
      'order' => 2,
    ],
    'supplier'      => [
      'show'  => true,
      'order' => 3,
    ],
    'status'        => [
      'show'  => true,
      'order' => 4,
    ],
    'returnAgainst',
  ];

  public function purchaseOrder() {
    return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
  }

  public function items() {
    return $this->hasMany(PurchaseReceiptItem::class);
  }

  public function supplier() {
    return $this->belongsTo(Supplier::class);
  }

  public function paymentSchedules() {
    return $this->morphMany(PaymentSchedule::class, 'payment_scheduleable')->orderBy('payment_date', 'asc');
  }

  public function returnAgainst() {
    return $this->belongsTo(PurchaseReceipt::class, 'return_against_id');
  }
}
