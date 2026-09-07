<?php

namespace App\Models\Service;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Services\Service\WorkOrderService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkOrder extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    /**
     * Fitur ini sudah digantikan AssetService (menu disembunyikan di
     * DeskSeeder), tapi model & data tetap dipertahankan. Alias di-set eksplisit
     * supaya Permission.name tidak bentrok dengan AssetService yang sekarang
     * memakai nama "Work Order" (lihat AssetService::$alias).
     */
    public static string $alias = 'Work Order (Lama)';

    public static string $service = WorkOrderService::class;
    protected $guarded            = ['id'];
    protected $casts              = [
        'date'         => 'datetime',
        'started_at'   => 'datetime',
        'completed_at' => 'datetime',
    ];
    protected $appends = ['for_internal'];

    protected function forInternal(): Attribute {
        return new Attribute(get: fn () => $this->customer_id == null);
    }

    protected static string $defaultFormatCode = '@[branch_code]/WO-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.item',
            'items.unit',
            'customer',
            'customerBranch',
            'itemService',
        ];
    }

    public static function templateLink() {
        return ':code';
    }

    public string $formComponent   = 'Services/WorkOrders/Form';
    public string $translateKey    = 'service.workOrder';
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
        'branch',
        'for_internal' => [
            'type'      => 'boolean',
            'show'      => true,
            'width'     => 'fit',
            'order'     => 3,
            'dependsOn' => ['customer_id'],
        ],
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
        'customer' => [
            'show'  => true,
            'order' => 4,
        ],
        'customerBranch' => [
            'disabledNavigation' => true,
        ],
        'itemService' => [
            'show'  => true,
            'order' => 5,
        ],
        'status' => [
            'show'  => true,
            'order' => 8,
        ],
        'customer_name' => [
            'ignore' => true,
        ],
        'customer_branch_name' => [
            'ignore' => true,
        ],
        'item_service_name' => [
            'ignore' => true,
        ],
    ];

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    public function items() {
        return $this->hasMany(WorkOrderItem::class)->with(['item', 'unit']);
    }

    public function customer() {
        return $this->belongsTo(Customer::class);
    }

    public function customerBranch() {
        return $this->belongsTo(Branch::class, 'customer_branch_id');
    }

    public function itemService() {
        return $this->belongsTo(ItemVariant::class, 'item_service_id');
    }

    public function canCancel(): bool {
        return ! \in_array(FormStatus::COMPLETED, (array) $this->status);
    }
}
