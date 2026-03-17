<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentTerm extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public static function templateLink() {
        return ':name';
    }

    protected $configColumns = [
        'name' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'due_date_based_on' => [
            'order'      => 1,
            'show'       => true,
            'valueTrans' => 'finances.paymentTerm.columns.due_date_based_on.options',
        ],
        'credit_period' => [
            'type'  => 'numeric',
            'order' => 2,
            'show'  => true,
        ],
        'invoice_portion' => [
            'type'  => 'numeric',
            'order' => 3,
            'show'  => true,
        ],
        'paymentMethod' => [
            'order' => 4,
            'show'  => true,
        ],
    ];
    public string $translateKey = 'finances.paymentTerm';

    public function paymentMethod() {
        return $this->belongsTo(PaymentMethod::class);
    }
}
