<?php

namespace App\Models\Finances;

use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesInvoice extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected               $guarded           = ['id'];
  protected               $casts             = [
    "date" => "datetime",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/SalesInvoice-@[iiii]/@[yy]';

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
  public    $translateKey  = 'finances.salesInvoice';
  protected $configColumns = [
    'code'                    => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'date'                    => [
      'type'  => 'date',
      'show'  => true,
      'order' => 1,
    ],
    'salesOrder'              => [
      'type'  => 'relation',
      'show'  => true,
      'order' => 2,
    ],
    'customer'                => [
      'type'  => 'relation',
      'show'  => true,
      'order' => 3,
    ],
    'status'                  => [
      'show'  => true,
      'order' => 4,
    ],
    'customer_branch',
    "currency",
    'branch'                  => [
      'ignore' => true,
    ],
    'base_currency_code'      => [
      'ignore' => true,
    ],
    'base_amount'             => [
      'ignore' => true,
    ],
    'base_outstanding_amount' => [
      'ignore' => true,
    ],
    'base_paid_amount'        => [
      'ignore' => true,
    ],
    'customer_branch_name'    => [
      'ignore' => true,
    ],
    'customer_name'           => [
      'ignore' => true,
    ],
  ];

  public function salesOrder() {
    return $this->belongsTo(SalesOrder::class, 'sales_order_id');
  }

  public function items() {
    return $this->hasMany(SalesInvoiceItem::class);
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
