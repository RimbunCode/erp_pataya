<?php

namespace App\Models\Inventory;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Finances\Account;
use App\Models\Finances\AdditionalCost;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockEntry extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;
    protected               $guarded           = ['id'];
    protected               $casts             = [
        'date'          => 'datetime',
        'received_date' => 'datetime',
        'using_transit' => 'boolean',
    ];
    public string           $keyBreadcrumb     = 'code';
    protected static string $defaultFormatCode = '@[branch_code]/StockEntry-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public static function templateLink() {
        return ':code';
    }
    // EXAMPLE appendStatus
    /**
     * @return FormStatus[]
     */
    // protected function appendStatus(): array {
    //   return [FormStatus::OVERDUE];
    // }
    public string   $translateKey  = 'inventory.stockEntry';
    protected array $configColumns = [
        'code'                 => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'date'                 => [
            'show'  => true,
            'order' => 1,
        ],
        'type'                 => [
            'show'       => true,
            'order'      => 2,
            'valueTrans' => 'inventory.stockEntry.types',
        ],
        'status'               => [
            'show'  => true,
            'order' => 3,
        ],
        'total_incoming_value' => [
            'type' => 'currency',
        ],
        'items',
        'additionalCosts',
        'differenceAccount',
        'referenceable',
    ];

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.item',
            'items.unit',
            'items.sourceWarehouse',
            'items.targetWarehouse',
            'referenceable',
            'additionalCosts',
            'differenceAccount',
        ];
    }

    public function branch() {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function differenceAccount() {
        return $this->belongsTo(Account::class, 'difference_account_id');
    }

    public function items() {
        return $this->hasMany(StockEntryItem::class);
    }

    public function additionalCosts() {
        return $this->morphMany(AdditionalCost::class, 'referenceable');
    }

    public function referenceable() {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }
}
