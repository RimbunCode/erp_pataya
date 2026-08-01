<?php

namespace App\Models\Finances;

use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseInvoice extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public string $formComponent = 'Finances/PurchaseInvoice/Form';
    protected $guarded           = ['id'];
    protected $casts             = [
        'date'                             => 'datetime',
        'exchange_rate'                    => 'float',
        'amount'                           => 'float',
        'amount_base_currency'             => 'float',
        'paid_amount'                      => 'float',
        'paid_amount_base_currency'        => 'float',
        'outstanding_amount'               => 'float',
        'outstanding_amount_base_currency' => 'float',
        'discount_rate'                    => 'float',
        'discount_amount'                  => 'float',
        'discount_amount_base_currency'    => 'float',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/PurchaseINV-@[iiii]/@[yy]';

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

    public $translateKey           = 'finances.purchaseInvoice';
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
        'purchaseOrder' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'supplier' => [
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        'currency',
        'branch' => [
            'ignore' => true,
        ],
        'base_currency_code' => [
            'hidden' => true,
        ],
        'base_amount' => [
            'hidden' => true,
        ],
        'base_outstanding_amount' => [
            'hidden' => true,
        ],
        'base_paid_amount' => [
            'hidden' => true,
        ],
        'supplier_name' => [
            'ignore' => true,
        ],
        'expenseHeadAccount',
        'creditAccount',
        'returnAgainst',
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
        'paymentSchedules',
    ];

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.purchaseOrderItem',
            'items.purchaseOrderItem.item',
            'items.unit',
            'items.targetWarehouse',
            'items.tax',
            'branch',
            'currency',
            'supplier',
            'purchaseOrder',
            'paymentSchedules',
            'paymentSchedules.paymentMethod',
            'expenseHeadAccount',
            'creditAccount',
            'returnAgainst',
        ];
    }

    public function returnAgainst() {
        return $this->belongsTo(PurchaseInvoice::class, 'return_against_id');
    }

    public function expenseHeadAccount() {
        return $this->belongsTo(Account::class, 'expanse_head_account_id');
    }

    public function creditAccount() {
        return $this->belongsTo(Account::class, 'credit_account_id');
    }

    public function purchaseOrder() {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function items() {
        return $this->hasMany(PurchaseInvoiceItem::class);
    }

    public function supplier() {
        return $this->belongsTo(Supplier::class);
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
}
