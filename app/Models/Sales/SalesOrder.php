<?php

namespace App\Models\Sales;

use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Finances\PaymentSchedule;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class SalesOrder extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected $guarded = ['id'];
  protected $casts = [
    "date" => "datetime",
    "is_rent" => "boolean",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/SO-@[iiii]/@[yy]';
  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name'
    ];
  }
  public $keyBreadcrumb = "code";

  public static function templateLink()
  {
    return ":code";
  }
  public $translateKey = 'sales.salesOrder';
  protected $configColumns = [
    'code' => [
      'isLink' => true,
      'show' => true,
      'order' => 0,
    ],
    'customer' => [
      'show' => true,
      'order' => 1,
    ],
    'date' => [
      'show' => true,
      'order' => 2,
    ],
    'status' => [
      'show' => true,
      'order' => 3
    ],
    'customer_branch',
    "currency",
    'branch' => [
      'ignore' => true,
    ]
  ];
  protected static function loadRelationsOnShow() {
    return [
      'items',
      'customer',
      'customer_branch',
      'currency',
      'items.item',
      'items.tax',
      'items.unit',
      'items.sourceWarehouse',
      'paymentSchedules',
      'paymentSchedules.paymentTerm',
      'paymentSchedules.paymentMethod',
    ];
  }

  public function items() {
    return $this->hasMany(SalesOrderItem::class);
  }

  public function customer() {
    return $this->belongsTo(Customer::class);
  }

  public function customer_branch() {
    return $this->belongsTo(Branch::class, 'customer_branch_id');
  }

  public function branch() {
    return $this->belongsTo(Branch::class);
  }

  public function currency() {
    return $this->belongsTo(Currency::class, 'currency_code');
  }
  public function paymentSchedules() {
    return $this->morphMany(PaymentSchedule::class, 'payment_scheduleable')->orderBy('payment_date', 'asc');
  }
}
