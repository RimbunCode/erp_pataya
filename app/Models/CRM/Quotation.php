<?php

namespace App\Models\CRM;

use App\Models\Model;
use App\Models\Sales\Customer;
use App\Services\CRM\QuotationService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quotation extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = QuotationService::class;
    protected $guarded            = ['id'];
    public $keyBreadcrumb         = 'code';
    public $translateKey          = 'crm.quotation';
    public string $formComponent  = 'CRM/Quotations/Form';
    protected $casts              = [
        'date'        => 'datetime',
        'valid_until'  => 'date',
        'basic_amount' => 'float',
        'tax_amount'   => 'float',
        'amount'       => 'float',
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
            'show'      => true,
            'order'     => 1,
            'groupable' => true,
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
            'show'           => true,
            'order'          => 4,
            'groupAggregate' => 'sum',
        ],
        'status' => [
            'show'  => true,
            'order' => 5,
        ],
        'type' => [
            'show'  => false,
            'order' => 6,
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
            'sections',
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

    public function sections() {
        return $this->hasMany(QuotationSection::class)->orderBy('order');
    }
}
