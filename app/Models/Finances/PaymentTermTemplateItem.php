<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentTermTemplateItem extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded          = ['id'];
    public string $translateKey = 'finances.paymentTerm';
    protected $configColumns    = [
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

    public function paymentMethod() {
        return $this->belongsTo(PaymentMethod::class);
    }
}
