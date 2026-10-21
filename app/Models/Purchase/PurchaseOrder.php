<?php

namespace App\Models\Purchase;

use App\Enums\FormStatus;
use App\Models\Core\Currency;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Model;
use App\Services\Purchase\PurchaseOrderService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = PurchaseOrderService::class;
    protected $guarded            = ['id'];
    protected $casts              = [
        'required_date'                 => 'datetime',
        'date'                          => 'datetime',
        'exchange_rate'                 => 'float',
        'amount'                        => 'float',
        'amount_base_currency'          => 'float',
        'discount_rate'                 => 'float',
        'discount_amount'               => 'float',
        'discount_amount_base_currency' => 'float',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/PO-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb        = 'code';
    public string $formComponent = 'Purchase/PurchaseOrders/Form';
    public string $translateKey  = 'purchase.purchaseOrder';

    /**
     * Kolom yang dicari teks bebas Search Bar DataTable2 (chip "Cari") --
     * lihat DataTable::getSearchScope().
     *
     * @var list<string>
     */
    protected static array $searchScope = ['code', 'external_note', 'supplier.name'];

    /**
     * Aksi memakai rute dan parameter ref yang sama dengan dropdown Actions
     * di Purchase/PurchaseOrders/Show.jsx.
     */
    public static function expectedRelationPanels(): array {
        return [
            PurchaseReceipt::class => [
                'action' => [
                    'route'      => 'purchaseReceipts.create',
                    'params'     => ['ref' => 'purchaseOrder/{id}'],
                    'label'      => 'purchase.purchaseOrder.actions.create_purchase_receipt',
                    'permission' => 'create',
                ],
                'remainder' => [
                    'title'   => 'purchase.purchaseOrder.panel.receipt.remainder',
                    'columns' => [
                        ['key' => 'item', 'label' => 'purchase.purchaseOrder.columns.item', 'align' => 'left'],
                        ['key' => 'remaining', 'label' => 'purchase.purchaseOrder.panel.remaining', 'align' => 'right', 'format' => 'number'],
                    ],
                    'rows' => 'unreceivedItemRows',
                ],
            ],
            PurchaseInvoice::class => [
                'action' => [
                    'route'      => 'purchaseInvoices.create',
                    'params'     => ['ref' => 'purchaseOrder/{id}'],
                    'label'      => 'purchase.purchaseOrder.actions.create_purchase_invoice',
                    'permission' => 'create',
                ],
                'remainder' => [
                    'title'   => 'purchase.purchaseOrder.panel.invoice.remainder',
                    'columns' => [
                        ['key' => 'item', 'label' => 'purchase.purchaseOrder.columns.item', 'align' => 'left'],
                        ['key' => 'remaining', 'label' => 'purchase.purchaseOrder.panel.remaining', 'align' => 'right', 'format' => 'number'],
                    ],
                    'rows' => 'unbilledItemRows',
                ],
            ],
        ];
    }

    /**
     * Item yang belum diterima sama sekali atau sebagian. Dibaca dari kolom
     * generated unreceived_quantity, tidak dihitung ulang di sini.
     *
     * @return array<int, array{item: string|null, remaining: float}>
     */
    public function unreceivedItemRows(): array {
        return $this->itemRemainderRows('unreceived_quantity');
    }

    /**
     * Item yang belum ditagihkan sama sekali atau sebagian, dari kolom generated
     * unbilled_quantity.
     *
     * @return array<int, array{item: string|null, remaining: float}>
     */
    public function unbilledItemRows(): array {
        return $this->itemRemainderRows('unbilled_quantity');
    }

    /**
     * @return array<int, array{item: string|null, remaining: float}>
     */
    private function itemRemainderRows(string $remainingColumn): array {
        $this->loadMissing('items.item');

        return $this->items
            ->filter(fn (PurchaseOrderItem $item): bool => $item->{$remainingColumn} > 0)
            ->map(fn (PurchaseOrderItem $item): array => [
                'item'      => $item->item?->item_name ?? $item->item_name,
                'remaining' => $item->{$remainingColumn},
            ])
            ->values()
            ->all();
    }

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
        'supplier' => [
            'type'      => 'relation',
            'show'      => true,
            'order'     => 2,
            'groupable' => true,
        ],
        'status' => [
            'show'  => true,
            'order' => 3,
        ],
        'currency_code',
        'base_currency_code' => [
            'hidden' => true,
        ],
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];

    public static function templateLink() {
        return ':code';
    }

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.item',
            'supplier',
            'items.unit',
            'items.tax',
            'items.targetWarehouse',
            'currency',
            'paymentSchedules',
            'paymentSchedules.paymentMethod',
        ];
    }

    public function currency() {
        return $this->belongsTo(Currency::class);
    }

    public function supplier() {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * Dipakai saat PO menjadi tujuan panel di halaman AssetService.
     */
    public static function relationPanel(): array {
        return [
            'title'   => 'purchase.purchaseOrder.panel.title',
            'columns' => [
                ['key' => 'code', 'label' => 'purchase.purchaseOrder.panel.code', 'align' => 'left'],
                ['key' => 'status', 'label' => 'purchase.purchaseOrder.panel.status', 'align' => 'left', 'format' => 'status'],
            ],
        ];
    }

    public function relationPanelRow(): array {
        return [
            'code'   => $this->code,
            'status' => $this->status,
        ];
    }

    public function items() {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function paymentSchedules() {
        return $this->morphMany(PaymentSchedule::class, 'payment_scheduleable')
            ->orderBy('due_date', 'asc');
    }

    public function canCancel(): bool {
        $blockingStatuses = [
            FormStatus::DELIVERED,
            FormStatus::PARTIALLY_DELIVERED,
            FormStatus::RECEIVED,
            FormStatus::PARTIALLY_RECEIVED,
            FormStatus::BILLED,
            FormStatus::PARTIALLY_BILLED,
            FormStatus::COMPLETED,
        ];

        foreach ($blockingStatuses as $status) {
            if (\in_array($status, (array) $this->status, true)) {
                return false;
            }
        }

        return true;
    }
}
