<?php

namespace App\Models\Finances;

use App\FormStatus;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use function PHPSTORM_META\type;

class PaymentSchedule extends Model {
  use HasUlids, SoftDeletes, DataTable;
  protected $withs = [
    'referenceTo',
  ];

  protected static function loadRelationsOnShow() {
    return [
      'referenceTo',
      'paymentMethod',
    ];
  }
  protected     $configColumns = [
    'referenceTo'             => [
      'type'               => 'relation',
      'order'              => 0,
      'show'               => true,
      'disabledNavigation' => true,
      'isLink'             => true,
    ],
    'due_date'                => [
      'order' => 1,
      'show'  => true,
    ],
    'payment_amount'          => [
      'order' => 2,
      'show'  => true,
    ],
    'outstanding_amount'      => [
      'order' => 3,
      'show'  => true,
    ],
    'status'                  => [
      'type'       => 'string',
      'order'      => 4,
      'show'       => true,
      'valueTrans' => 'status',
    ],
    'paymentTerm',
    'paymentMethod',

    'base_currency_code'      => [
      'ignore' => true,
    ],
    'base_outstanding_amount' => [
      'ignore' => true,
    ],
    'base_paid_amount'        => [
      'ignore' => true,
    ],
    'base_payment_amount'     => [
      'ignore' => true,
    ],
  ];
  protected     $appends       = ['status'];
  public string $translateKey  = 'finances.paymentSchedule';
  protected     $casts         = [
    'for_internal' => 'boolean',
    'due_date'     => 'datetime',
    'payment_date' => 'datetime',
    'submitted_at' => 'datetime',
  ];
  protected     $guarded       = ['id'];

  public function status(): Attribute {
    return new Attribute(
      get: function () {
        if ($this->outstanding_amount <= 0) {
          return FormStatus::COMPLETED;
        } elseif ($this->paid_amount > 0) {
          return FormStatus::PARTIALLY_PAID;
        } else {
          return FormStatus::TO_BILL;
        }
      }
    );
  }

  public function paymentTerm() {
    return $this->belongsTo(PaymentTerm::class);
  }

  public function paymentMethod() {
    return $this->belongsTo(PaymentMethod::class);
  }

  public function referenceTo() {
    return $this->morphTo('payment_scheduleable');
  }
}
