<?php

namespace App\Models\CRM;

use App\Models\Model;
use App\Models\Sales\Customer;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quotation extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    protected $guarded    = ['id'];
    public $keyBreadcrumb = 'code';
    public $translateKey  = 'crm.quotation';
    protected $casts      = [
        'date'        => 'datetime',
        'valid_until' => 'date',
        'amount'      => 'float',
    ];

    public static function templateLink() {
        return ':code';
    }

    protected static string $defaultFormatCode = '@[branch_code]/QTN-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    protected array $configColumns = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'customer' => [
            'show'  => true,
            'order' => 1,
        ],
        'date' => [
            'show'  => true,
            'order' => 2,
        ],
        'valid_until' => [
            'show'  => true,
            'order' => 3,
        ],
        'amount' => [
            'show'  => true,
            'order' => 4,
        ],
        'status' => [
            'show'  => true,
            'order' => 5,
        ],
        'opportunity',
        'branch',
        'referenceable',
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'referenceable',
            'items',
            'items.item',
            'customer',
            'opportunity',
            'branch',
        ];
    }

    public function referenceable() {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }

    public function opportunity() {
        return $this->belongsTo(Opportunity::class);
    }

    public function customer() {
        return $this->belongsTo(Customer::class);
    }

    public function items() {
        return $this->hasMany(QuotationItem::class);
    }
}
