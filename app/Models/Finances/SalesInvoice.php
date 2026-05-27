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
    use DataTable, HasUlids, SoftDeletes, Submitable;

    protected $guarded = ['id'];
    protected $casts   = [
        'date' => 'datetime',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/SalesInvoice-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    public static function templateLink() {
        return ':code';
    }

    protected $appends = [
        'is_return',
    ];

    protected function getIsReturnAttribute() {
        return $this->return_against_id != null;
    }

    public $translateKey           = 'finances.salesInvoice';
    protected array $configColumns = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'date' => [
            'type'  => 'date',
            'show'  => true,
            'order' => 1,
        ],
        'salesOrder' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'customer' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        'customerBranch',
        'currency',
        'branch' => [
            'ignore' => true,
        ],
        'base_currency_code' => [
            'ignore' => true,
        ],
        'base_amount' => [
            'ignore' => true,
        ],
        'base_outstanding_amount' => [
            'ignore' => true,
        ],
        'base_paid_amount' => [
            'ignore' => true,
        ],
        'customer_branch_name' => [
            'ignore' => true,
        ],
        'customer_name' => [
            'ignore' => true,
        ],
        'incomeAccount',
        'debitAccount',
        'returnAgainst',
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'salesOrder',
            'customer',
            'customerBranch',
            'branch',
            'currency',
            'items',
            'items.item',
            'items.tax',
            'items.unit',
            'paymentSchedules',
            'paymentSchedules.paymentMethod',
            'incomeAccount',
            'debitAccount',
            'returnAgainst',
        ];
    }

    public function returnAgainst() {
        return $this->belongsTo(SalesInvoice::class, 'return_against_id');
    }

    public function salesOrder() {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    public function items() {
        return $this->hasMany(SalesInvoiceItem::class);
    }

    public function customer() {
        return $this->belongsTo(Customer::class);
    }

    public function customerBranch() {
        return $this->belongsTo(Branch::class, 'customer_branch_id');
    }

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    public function currency() {
        return $this->belongsTo(Currency::class, 'currency_code');
    }

    public function paymentSchedules() {
        return $this->morphMany(PaymentSchedule::class, 'payment_scheduleable')
            ->orderBy('due_date', 'asc');
    }

    public function debitAccount() {
        return $this->belongsTo(Account::class, 'debit_account_id');
    }

    public function incomeAccount() {
        return $this->belongsTo(Account::class, 'income_account_id');
    }
}
