<?php

namespace App\Models\Finances;

use App\Models\Core\Currency;
use App\Models\Model;
use App\Services\Finances\PaymentEntryService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentEntry extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service              = PaymentEntryService::class;
    public string $formComponent               = 'Finances/PaymentEntries/Form';
    protected static string $defaultFormatCode = 'PaymentEntry-@[iiii]/@[yy]';
    protected $casts                           = [
        'date'             => 'datetime',
        'paid_amount'      => 'float',
        'base_paid_amount' => 'float',
        'exchange_rate'    => 'float',
    ];
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':code';
    }

    protected static function loadRelationsOnShow() {
        return [
            'paymentMethod',
            'currency',
            'partyable',
            'paymentable',
            'paymentable.paymentSchedules',
            'paymentable.paymentSchedules.paymentMethod',
            'accountPaidTo',
            'accountPaidFrom',
        ];
    }

    protected array $configColumns = [
        'code' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,

        ],
        'date' => [
            'order' => 1,
            'show'  => true,
        ],
        'paymentMethod' => [
            'order' => 2,
            'show'  => true,
        ],
        'paymentable' => [
            'order' => 3,
            'show'  => true,
        ],
        'partyable' => [
            'order' => 4,
            'show'  => true,
        ],
        'paid_amount' => [
            'order' => 5,
            'show'  => true,
        ],
        'status' => [
            'order' => 6,
            'show'  => true,
        ],
        'accountPaidTo',
        'accountPaidFrom',
        'base_currency_code' => [
            'hidden' => true,
        ],
        'base_paid_amount' => [
            'hidden' => true,
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

    public function paymentable() {
        return $this->morphTo('paymentable');
    }

    public function accountPaidTo() {
        return $this->belongsTo(Account::class, 'account_paid_to_id');
    }

    public function accountPaidFrom() {
        return $this->belongsTo(Account::class, 'account_paid_from_id');
    }
}
