<?php

namespace App\Models\Finances;

use App\Models\Core\Currency;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentEntry extends Model {
  use HasUlids, SoftDeletes, DataTable, Submitable;
  protected static string $defaultFormatCode = '@[branch_code]/PaymentEntry-@[iiii]/@[yy]';
  protected               $casts             = [
    "date" => "datetime",
  ];

  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name',
    ];
  }
  protected $guarded = ['id'];

  public static function templateLink() {
    return ":name";
  }

  protected static function loadRelationsOnShow() {
    return [
      'paymentMethod',
      'currency',
      'partyable',
    ];
  }
  protected $configColumns = [
    'date'           => [
      'order'  => 0,
      'show'   => true,
      'isLink' => true,
    ],
    'payment_type'   => [
      'order' => 1,
      'show'  => true,
    ],
    'payment_method' => [
        'order' => 2,
        'show'  => true,
      ],
    'partyable'      => [
        'order' => 3,
        'show'  => true,
      ],
    'paid_amount'    => [
        'order' => 4,
        'show'  => true,
      ],
  ];
  public string $translateKey = 'finances.paymentEntry';

  public function paymentMethod() {
    return $this->belongsTo(PaymentMethod::class);
  }

  public function currency() {
    return $this->belongsTo(Currency::class);
  }

  public function partyable() {
    return $this->morphTo('partyable');
  }
}
