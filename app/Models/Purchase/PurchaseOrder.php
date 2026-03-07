<?php

namespace App\Models\Purchase;

use App\Models\Core\Currency;
use App\Models\Finances\PaymentSchedule;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use DataTable, HasUlids, SoftDeletes, Submitable;

    protected $guarded = ['id'];

    protected $casts = [
        'required_date' => 'datetime',
        'date' => 'datetime',
    ];

    protected static string $defaultFormatCode = '@[branch_code]/PO-@[iiii]/@[yy]';

    public function codeRelations()
    {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    public string $formComponent = 'Purchase/PurchaseOrders/Form';

    public string $translateKey = 'purchase.purchaseOrder';

    protected $configColumns = [
        'code' => [
            'isLink' => true,
            'show' => true,
            'order' => 0,
        ],
        'date' => [
            'type' => 'date',
            'show' => true,
            'order' => 1,
        ],
        'supplier' => [
            'type' => 'relation',
            'show' => true,
            'order' => 2,
        ],
        'status' => [
            'show' => true,
            'order' => 3,
        ],
        'currency_code',
        'base_currency_code' => [
            'ignore' => true,
        ],

    ];

    public static function templateLink()
    {
        return ':code';
    }

    protected static function loadRelationsOnShow()
    {
        return ['items', 'items.item', 'supplier', 'items.unit', 'items.tax', 'items.targetWarehouse', 'currency'];
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function paymentSchedules()
    {
        return $this->morphMany(PaymentSchedule::class, 'payment_scheduleable')
            ->orderBy('due_date', 'asc');
    }
}
