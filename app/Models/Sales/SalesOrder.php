<?php

namespace App\Models\Sales;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Model;
use App\Services\Sales\RentalDurationService;
use App\Services\Sales\SalesOrderService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrder extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = SalesOrderService::class;
    public string $formComponent  = 'Sales/SalesOrders/Form';
    protected $guarded            = ['id'];
    public $keyBreadcrumb         = 'code';
    public $translateKey          = 'sales.salesOrder';
    protected $casts              = [
        'date'                          => 'datetime',
        'is_rent'                       => 'boolean',
        'start_date'                    => 'datetime',
        'end_date'                      => 'datetime',
        'exchange_rate'                 => 'float',
        'discount_amount'               => 'float',
        'discount_rate'                 => 'float',
        'discount_amount_base_currency' => 'float',
        'amount'                        => 'float',
        'amount_base_currency'          => 'float',
    ];
    protected $appends = [
        'rent_date',
        'rental_durations',
    ];

    /**
     * Aksi sama dengan dropdown di Sales/SalesOrders/Show.jsx. Keduanya hanya
     * muncul pada status tertentu di dropdown; panel menampilkan tombolnya
     * selalu, dan izin create tetap diperiksa di backend.
     */
    public static function expectedRelationPanels(): array {
        return [
            SalesInvoice::class => [
                'action' => [
                    'route'      => 'salesInvoices.create',
                    'params'     => ['ref' => 'salesOrder/{id}'],
                    'label'      => 'sales.salesOrder.actions.create_sales_invoice',
                    'permission' => 'create',
                ],
            ],
            DeliveryNote::class => [
                'action' => [
                    'route'      => 'deliveryNotes.create',
                    'params'     => ['ref' => 'salesOrder/{id}'],
                    'label'      => 'sales.salesOrder.actions.create_delivery_note',
                    'permission' => 'create',
                ],
            ],
        ];
    }

    public static function templateLink() {
        return ':code';
    }

    public function rentDate(): Attribute {
        return Attribute::make(
            get: fn () => [
                'from' => $this->start_date,
                'to'   => $this->end_date,
            ],
            set: fn ($value) => [
                'start_date' => Carbon::parse($value['from'])->utc(),
                'end_date'   => Carbon::parse($value['to'])->utc(),
            ],
        );
    }

    public function rentalDurations(): Attribute {
        return Attribute::make(
            get: function () {
                if (! $this->is_rent) {
                    return null;
                }

                $service = app(RentalDurationService::class);

                return $this->items->mapWithKeys(fn ($item) => [
                    $item->id => $service->calculateDuration($item),
                ]);
            },
        );
    }

    protected static string $defaultFormatCode = '@[branch_code]/SO-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    /**
     * Kolom yang dicari teks bebas Search Bar DataTable2 (chip "Cari") --
     * lihat DataTable::getSearchScope().
     *
     * @var list<string>
     */
    protected static array $searchScope = ['code', 'external_note', 'customer.name'];

    /*
     * Kolom `billed_percent` / `delivered_percent` (type progress) memakai `expression`: subquery
     * berkorelasi ke sales_order_items yang dihitung di database sehingga bisa ditampilkan,
     * diurutkan, dan difilter tanpa memuat semua item. Item soft-delete diabaikan; pembagi nol
     * -> NULL (sel menampilkan "-").
     */
    protected array $configColumns = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
            // Dua baris: kode tebal + nama customer redup. Sort/search tetap mengikuti kolom `code`.
            'template' => '<stack><strong>:code</strong><muted>:customer.name</muted></stack>',
        ],
        'customer' => [
            'show'      => true,
            'order'     => 1,
            'groupable' => true,
        ],
        'date' => [
            'show'  => true,
            'order' => 2,
        ],
        'is_rent' => [
            'show'      => true,
            'order'     => 3,
            'groupable' => true,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        // % tertagih (donut, default) dan % terkirim (bar) -- kolom expression bertipe progress.
        'billed_percent' => [
            'type'       => 'progress',
            'expression' => '(SELECT SUM(soi.billed_quantity) * 100.0 / NULLIF(SUM(soi.quantity), 0)'
                . ' FROM sales_order_items soi WHERE soi.sales_order_id = sales_orders.id AND soi.deleted_at IS NULL)',
            'show'  => true,
            'order' => 5,
        ],
        'delivered_percent' => [
            'type'       => 'progress',
            'shape'      => 'bar',
            'expression' => '(SELECT SUM(soi.delivered_quantity) * 100.0 / NULLIF(SUM(soi.quantity), 0)'
                . ' FROM sales_order_items soi WHERE soi.sales_order_id = sales_orders.id AND soi.deleted_at IS NULL)',
            'show'  => true,
            'order' => 6,
        ],
        // Kolom virtual template, opt-in pencarian: dicari lewat nama customer & cabangnya.
        'customer_summary' => [
            'template'   => '<stack><strong>:customer.name</strong><muted>:customer_branch.name</muted></stack>',
            'searchable' => true,
            'show'       => false,
        ],
        'customerBranch' => [
            'disabledNavigation' => true,
        ],
        'currency' => [
            'groupable' => true,
        ],
        'branch',
        'customer_name' => [
            'ignore' => true,
        ],
        'customer_branch_name' => [
            'ignore' => true,
        ],
        'discount_amount_base_currency' => [
            'hidden' => true,
        ],
        'amount' => [
            'hidden' => true,
        ],
        'amount_base_currency' => [
            'hidden' => true,
        ],
        'base_currency_code' => [
            'hidden' => true,
        ],
        'referenceable',
        'referenceSo',
        'start_date' => [
            'ignore' => true,
        ],
        'end_date' => [
            'ignore' => true,
        ],
        'rent_date' => [
            'type'      => 'datetime',
            'dependsOn' => ['start_date', 'end_date'],
        ],
        'rental_durations' => [
            'dependsOn' => ['is_rent', 'items'],
        ],
        // `max` = opt-in tampilan chip relasi banyak (default FE 3 chip; 0 = tanpa batas).
        'items' => [
            'show'  => true,
            'order' => 10,
            'max'   => 3,
        ],
    ];

    /**
     * Template kartu mobile DataTable2 (dipakai bila halaman tidak memberi `templateItem`).
     */
    public static function mobileTemplate(): string {
        return '<stack><nav-link><strong>:code</strong></nav-link><muted>:customer.name</muted>'
            . '<inline><muted>:date|date</muted><progress value=":billed_percent" shape="bar"/></inline></stack>';
    }

    protected static function loadRelationsOnShow() {
        return [
            'referenceable',
            'referenceSo',
            'items',
            'customer',
            'customerBranch',
            'currency',
            'items.item',
            'items.asset',
            'items.tax',
            'items.unit',
            'items.sourceWarehouse',
            'paymentSchedules',
            'paymentSchedules.paymentMethod',
        ];
    }

    public static function relationPanel(): array {
        return [
            'title'   => 'sales.salesOrder.panel.title',
            'columns' => [
                ['key' => 'code', 'label' => 'sales.salesOrder.panel.code', 'align' => 'left'],
                ['key' => 'date', 'label' => 'sales.salesOrder.panel.date', 'align' => 'left', 'format' => 'date'],
                ['key' => 'status', 'label' => 'sales.salesOrder.panel.status', 'align' => 'left', 'format' => 'status'],
            ],
        ];
    }

    public function relationPanelRow(): array {
        return [
            'code'   => $this->code,
            'date'   => $this->date,
            'status' => $this->status,
        ];
    }

    public function referenceable() {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }

    public function referenceSo() {
        return $this->belongsTo(SalesOrder::class, 'reference_so_id');
    }

    public function items() {
        return $this->hasMany(SalesOrderItem::class);
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
