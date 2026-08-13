<?php

namespace App\Models\Purchase;

use App\Models\Model;
use App\Services\Purchase\PurchaseReceiptService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseReceipt extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = PurchaseReceiptService::class;
    public string $formComponent  = 'Purchase/PurchaseReceipts/Form';
    protected $guarded            = ['id'];
    protected $casts              = [
        'date' => 'datetime',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/Receipt-@[iiii]/@[yy]';

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

    public $translateKey = 'purchase.purchaseReceipt';

    protected static function loadRelationsOnShow() {
        return ['items', 'items.purchaseOrderItem', 'items.purchaseOrderItem.item', 'supplier', 'items.unit', 'items.targetWarehouse', 'purchaseOrder', 'returnAgainst'];
    }

    protected array $configColumns = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'date' => [
            'show'  => true,
            'order' => 1,
        ],
        'purchaseOrder' => [
            'show'  => true,
            'order' => 2,
        ],
        'supplier' => [
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        'returnAgainst',
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];

    public function purchaseOrder() {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function items() {
        return $this->hasMany(PurchaseReceiptItem::class);
    }

    public function supplier() {
        return $this->belongsTo(Supplier::class);
    }

    public function returnAgainst() {
        return $this->belongsTo(PurchaseReceipt::class, 'return_against_id');
    }
}
