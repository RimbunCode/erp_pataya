<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentTermTemplate extends Model {
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
        'description' => [
            'order' => 1,
            'show'  => true,
        ],
    ];
    public string $translateKey = 'finances.paymentTermTemplate';

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.paymentMethod',
        ];
    }

    public function items() {
        return $this->hasMany(PaymentTermTemplateItem::class, 'payment_term_template_id', 'id');
    }
}
