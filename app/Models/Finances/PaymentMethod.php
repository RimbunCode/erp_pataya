<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentMethod extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public string $formComponent = 'Finances/PaymentMethods/Form';
    protected $guarded           = ['id'];

    public static function templateLink() {
        return ':name';
    }

    protected array $configColumns = [
        'name' => [
            'order'  => 0,
            'show'   => true,
            'isLink' => true,
        ],
        'defaultAccount' => [
            'order' => 1,
            'show'  => true,
        ],
        'description' => [
            'order' => 2,
            'show'  => true,
        ],
    ];
    public string $translateKey = 'finances.paymentMethod';

    public static function loadRelationsOnShow() {
        return ['defaultAccount'];
    }

    public function defaultAccount() {
        return $this->belongsTo(Account::class, 'default_account_id');
    }
}
