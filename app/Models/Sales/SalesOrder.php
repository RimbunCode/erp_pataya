<?php

namespace App\Models\Sales;

use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Finances\PaymentSchedule;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class SalesOrder extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected               $guarded           = ['id'];
  protected               $casts             = [
    "date"       => "datetime",
    "is_rent"    => "boolean",
    'start_date' => 'datetime',
    'end_date'   => 'datetime',
  ];
  protected               $appends           = [
    'rent_date',
  ];
  protected static string $defaultFormatCode = '@[branch_code]/SO-@[iiii]/@[yy]';

  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name',
    ];
  }

  public function rentDate(): Attribute {
    return Attribute::make(
      get: fn() => [
        'from' => $this->start_date,
        'to'   => $this->end_date,
      ],
      set: fn($value) => [
        'start_date' => Carbon::parse($value['from'])->utc(),
        'end_date'   => Carbon::parse($value['to'])->utc(),
      ]
    );
  }
  public $keyBreadcrumb = "code";

  public static function templateLink() {
    return ":code";
  }
  public    $translateKey  = 'sales.salesOrder';
  protected $configColumns = [
    'code'                          => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'customer'                      => [
      'show'  => true,
      'order' => 1,
    ],
    'date'                          => [
      'show'  => true,
      'order' => 2,
    ],
    'is_rent'                       => [
      'show'  => true,
      'order' => 3,
    ],
    'status'                        => [
      'show'  => true,
      'order' => 4,
    ],
    'customer_branch',
    "currency",
    'branch'                        => [
      'ignore' => true,
    ],
    'customer_name'                 => [
      'ignore' => true,
    ],
    'customer_branch_name'          => [
      'ignore' => true,
    ],
    'discount_amount_base_currency' => [
      'ignore' => true,
    ],
    'amount'                        => [
      'ignore' => true,
    ],
    'amount_base_currency'          => [
      'ignore' => true,
    ],
    'base_currency_code'            => [
      'ignore' => true,
    ],
    'referenceable',
    'referenceSo',
    'start_date'                    => [
      'ignore' => true,
    ],
    'end_date'                      => [
      'ignore' => true,
    ],
  ];

  protected static function loadRelationsOnShow() {
    return [
      'referenceable',
      'referenceSo',
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

  public function referenceable() {
    return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
  }

  public function referenceSo() {
    return $this->belongsTo(SalesOrder::class, 'reference_so_id');
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
