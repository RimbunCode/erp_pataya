<?php

namespace App\Models\Finances;

use App\Casts\Json;
use App\Enums\FormStatus;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentSchedule extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $withs = [
        'referenceTo',
    ];

    protected static function loadRelationsOnShow() {
        return [
            'referenceTo',
            'paymentMethod',
        ];
    }

    public static function templateLink() {
        return ':referenceTo';
    }

    protected array $configColumns = [
        'referenceTo' => [
            'order'              => 0,
            'show'               => true,
            'disabledNavigation' => true,
            'isLink'             => true,
        ],
        'due_date' => [
            'order' => 1,
            'show'  => true,
        ],
        'payment_amount' => [
            'order' => 2,
            'show'  => true,
        ],
        'outstanding_amount' => [
            'order' => 3,
            'show'  => true,
        ],
        'status' => [
            'type'       => 'string',
            'order'      => 4,
            'show'       => true,
            'valueTrans' => 'status',
            'dependsOn'  => ['outstanding_amount', 'paid_amount'],
        ],
        'paymentMethod',

        'base_currency_code' => [
            'hidden' => true,
        ],
        'base_outstanding_amount' => [
            'hidden' => true,
        ],
        'base_paid_amount' => [
            'hidden' => true,
        ],
        'base_payment_amount' => [
            'hidden' => true,
        ],
    ];
    protected $appends          = ['status'];
    public string $translateKey = 'finances.paymentSchedule';
    protected $casts            = [
        'for_internal'       => 'boolean',
        'due_date'           => 'datetime',
        'payment_date'       => 'datetime',
        'submitted_at'       => 'datetime',
        'discount_date'      => 'datetime',
        'logs'               => Json::class,
        'invoice_portion'    => 'float',
        'payment_amount'     => 'float',
        'paid_amount'        => 'float',
        'outstanding_amount' => 'float',
        'discount'           => 'float',
    ];
    protected $guarded = ['id'];

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
            },
        );
    }

    public function paymentMethod() {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function referenceTo() {
        return $this->morphTo('payment_scheduleable');
    }

    /**
     * Summary of getDetailPayment
     *
     * @param  Collection<PaymentSchedule>  $paymentSchedules
     * @return array
     */
    public static function getDetailPayment($paymentSchedules) {
        $total = 0;
        foreach ($paymentSchedules as $idx => $paymentSchedule) {
            if (
                $paymentSchedule->outstanding_amount <= 0 ||
                ($idx > 0 && now()->lessThan($paymentSchedule->due_date))
            ) {
                continue;
            }

            $total += $paymentSchedule->payment_amount;
        }

        $paymentMethod = $paymentSchedules->first()->paymentMethod;

        return [
            'amount'        => $total,
            'paymentMethod' => $paymentMethod,
            'accountBank'   => $paymentMethod?->defaultAccount ?? null,
        ];
    }
}
