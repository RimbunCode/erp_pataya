<?php

namespace App\Models\Sales;

use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Finances\PaymentSchedule;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrder extends Model
{
    use DataTable, HasUlids, SoftDeletes, Submitable;

    protected $guarded = ['id'];

    public $keyBreadcrumb = 'code';

    public $translateKey = 'sales.salesOrder';

    protected $casts = [
        'date' => 'datetime',
        'is_rent' => 'boolean',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
    ];

    protected $appends = [
        'rent_date',
    ];

    public static function templateLink()
    {
        return ':code';
    }

    public function rentDate(): Attribute
    {
        return Attribute::make(
            get: fn () => [
                'from' => $this->start_date,
                'to' => $this->end_date,
            ],
            set: fn ($value) => [
                'start_date' => Carbon::parse($value['from'])->utc(),
                'end_date' => Carbon::parse($value['to'])->utc(),
            ]
        );
    }

    protected static string $defaultFormatCode = '@[branch_code]/SO-@[iiii]/@[yy]';

    public function codeRelations()
    {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    protected $configColumns = [
        'code' => [
            'isLink' => true,
            'show' => true,
            'order' => 0,
        ],
        'customer' => [
            'show' => true,
            'order' => 1,
        ],
        'date' => [
            'show' => true,
            'order' => 2,
        ],
        'is_rent' => [
            'show' => true,
            'order' => 3,
        ],
        'status' => [
            'show' => true,
            'order' => 4,
        ],
        'customer_branch',
        'currency',
        'branch' => [
            'ignore' => true,
        ],
        'customer_name' => [
            'ignore' => true,
        ],
        'customer_branch_name' => [
            'ignore' => true,
        ],
        'discount_amount_base_currency' => [
            'ignore' => true,
        ],
        'amount' => [
            'ignore' => true,
        ],
        'amount_base_currency' => [
            'ignore' => true,
        ],
        'base_currency_code' => [
            'ignore' => true,
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
            'type' => 'datetime',
        ],
        'items',
    ];

    protected static function loadRelationsOnShow()
    {
        return [
            'referenceable',
            'referenceSo',
            'items',
            'customer',
            'customer_branch',
            'currency',
            'items.item',
            'items.tax',
            'items.unit',
            'items.sourceWarehouse',
            'paymentSchedules',
            'paymentSchedules.paymentTerm',
            'paymentSchedules.paymentMethod',
        ];
    }

    public function referenceable()
    {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }

    public function referenceSo()
    {
        return $this->belongsTo(SalesOrder::class, 'reference_so_id');
    }

    public function items()
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function customer_branch()
    {
        return $this->belongsTo(Branch::class, 'customer_branch_id');
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class, 'currency_code');
    }

    public function paymentSchedules()
    {
        return $this->morphMany(PaymentSchedule::class, 'payment_scheduleable')
            ->orderBy('due_date', 'asc');
    }
}
