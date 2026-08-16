<?php

namespace App\Models\Finances;

use App\Enums\FormStatus;
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

    public string $formComponent = 'Finances/SalesInvoice/Form';
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
        'tax_invoice_date'                 => 'datetime',
        'tax_invoice_dpp_amount'           => 'float',
        'tax_invoice_ppn_amount'           => 'float',
        'tax_invoice_ppnbm_amount'         => 'float',
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
        'is_return' => [
            'dependsOn' => ['return_against_id'],
        ],
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
        'customerBranch' => [
            'disabledNavigation' => true,
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
        'paymentSchedules',
        'tax_invoice_transaction_code' => [
            'valueTrans' => 'finances.taxInvoice.transaction_code.options',
            'show'       => true,
            'order'      => 20,
        ],
        'tax_invoice_serial_number' => [
            'show'  => true,
            'order' => 21,
        ],
        'tax_invoice_date' => [
            'type'  => 'date',
            'show'  => true,
            'order' => 22,
        ],
        'tax_invoice_dpp_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 23,
        ],
        'tax_invoice_ppn_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 24,
        ],
        'tax_invoice_ppnbm_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 25,
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
            'items.tax',
            'items.unit',
            'items.salesOrderItem',
            'items.salesOrderItem.item',
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

    public function canCancel(): bool {
        $blockingStatuses = [
            FormStatus::PAID,
            FormStatus::PARTIALLY_PAID,
        ];

        foreach ($blockingStatuses as $status) {
            if (\in_array($status, (array) $this->status, true)) {
                return false;
            }
        }

        return true;
    }
}
