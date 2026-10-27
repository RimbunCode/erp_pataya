<?php

namespace App\Models\Finances;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Services\Finances\PurchaseInvoiceService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseInvoice extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = PurchaseInvoiceService::class;
    public string $formComponent  = 'Finances/PurchaseInvoice/Form';
    protected $guarded            = ['id'];
    protected $casts              = [
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
    protected static string $defaultFormatCode = '@[branch_code]/PurchaseINV-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    /**
     * Aksi sama dengan dropdown di Finances/PurchaseInvoice/Show.jsx. Tombol
     * debit note di dropdown itu bukan panel relasi dan tidak dideklarasikan di sini.
     */
    public static function expectedRelationPanels(): array {
        return [
            PaymentEntry::class => [
                'action' => [
                    'route'      => 'paymentEntries.create',
                    'params'     => ['ref' => 'purchaseInvoice/{id}'],
                    'label'      => 'finances.purchaseInvoice.actions.create_payment_entry',
                    'permission' => 'create',
                ],
            ],
        ];
    }

    public static function templateLink() {
        return ':code';
    }

    public $translateKey = 'finances.purchaseInvoice';

    /**
     * Kolom yang dicari teks bebas Search Bar DataTable2 (chip "Cari") --
     * lihat DataTable::getSearchScope().
     *
     * @var list<string>
     */
    protected static array $searchScope = ['code', 'external_note', 'tax_invoice_serial_number', 'supplier.name'];

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
            'show'      => true,
            'order'     => 3,
            'groupable' => true,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        'currency' => [
            'groupable' => true,
        ],
        'branch' => [
            'hidden'     => true,
            'groupable'  => false,
            'searchable' => false,
        ],
        'base_currency_code' => [
            'hidden' => true,
        ],
        'amount_base_currency' => [
            'hidden' => true,
        ],
        'outstanding_amount_base_currency' => [
            'hidden' => true,
        ],
        'paid_amount_base_currency' => [
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
        'tax_invoice_transaction_code' => [
            'valueTrans' => 'finances.taxInvoice.transaction_code.options',
            'groupable'  => true,
        ],
        'tax_invoice_serial_number',
        'tax_invoice_date' => [
            'type' => 'date',
        ],
        'tax_invoice_dpp_amount' => [
            'type' => 'currency',
        ],
        'tax_invoice_ppn_amount' => [
            'type' => 'currency',
        ],
        'tax_invoice_ppnbm_amount' => [
            'type' => 'currency',
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.purchaseOrderItem',
            'items.purchaseOrderItem.item',
            'items.purchaseReceiptItem',
            'items.purchaseReceiptItem.item',
            'items.item',
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

    public static function relationPanel(): array {
        return [
            'title'   => 'purchase.purchaseOrder.panel.invoice.title',
            'columns' => [
                ['key' => 'code', 'label' => 'purchase.purchaseOrder.panel.invoice.code', 'align' => 'left'],
                ['key' => 'date', 'label' => 'purchase.purchaseOrder.panel.invoice.date', 'align' => 'left', 'format' => 'date'],
                ['key' => 'total', 'label' => 'purchase.purchaseOrder.panel.invoice.total', 'align' => 'right', 'format' => 'currency', 'aggregate' => 'sum', 'aggregate_key' => 'total_base'],
            ],
        ];
    }

    /**
     * `total` memakai `amount` (mata uang transaksi) supaya baris menampilkan
     * nilai asli dokumen. Baris total memakai `total_base`, karena invoice pada
     * satu PO boleh berbeda currency_code: lihat PurchaseInvoiceService saat
     * mengisi `currency_code` dari input, bukan mewarisi dari PO.
     */
    public function relationPanelRow(): array {
        return [
            'code'       => $this->code,
            'date'       => $this->date,
            'total'      => $this->amount,
            'total_base' => $this->amount_base_currency,
        ];
    }

    public static function relationPanelDetail(): array {
        return [
            'columns' => [
                ['key' => 'item', 'label' => 'purchase.purchaseOrder.columns.item', 'align' => 'left'],
                ['key' => 'quantity', 'label' => 'purchase.purchaseOrder.columns.quantity', 'align' => 'right', 'format' => 'number'],
            ],
            'eager' => ['items.item'],
        ];
    }

    public function relationPanelDetailRows(): array {
        return $this->items
            ->map(fn (PurchaseInvoiceItem $item): array => [
                'item'     => $item->item?->item_name ?? $item->item_name,
                'quantity' => $item->quantity,
            ])
            ->all();
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
