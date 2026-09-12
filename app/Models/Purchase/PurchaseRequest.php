<?php

namespace App\Models\Purchase;

use App\Enums\FormStatus;
use App\Models\Model;
use App\Services\Purchase\PurchaseRequestService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequest extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = PurchaseRequestService::class;
    protected $guarded            = ['id'];
    protected $casts              = [
        'date'          => 'datetime',
        'required_date' => 'datetime',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/PR-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public static function templateLink() {
        return ':code';
    }

    public $keyBreadcrumb          = 'code';
    public string $formComponent   = 'Purchase/PurchaseRequests/Form';
    public string $translateKey    = 'purchase.purchaseRequest';
    protected array $configColumns = [
        'code' => [
            'show'   => true,
            'isLink' => true,
            'order'  => 0,
        ],
        'date' => [
            'show'  => true,
            'order' => 1,
        ],
        'required_date' => [
            'show'  => true,
            'order' => 2,
        ],
        'status' => [
            'show'      => true,
            'order'     => 3,
            'dependsOn' => ['status', 'items.quantity', 'items.ordered_quantity', 'items.received_quantity'],
        ],
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.item',
            'items.unit',
        ];
    }

    protected function replaceStatus() {
        $items            = $this->items;
        $quantity         = $items->sum('quantity');
        $orderedQuantity  = $items->sum('ordered_quantity');
        $receivedQuantity = $items->sum('received_quantity');

        if ($orderedQuantity <= 0) {
            return [];
        }

        if ($orderedQuantity < $quantity) {
            return [
                FormStatus::TO_ORDER->value => [FormStatus::PARTIALLY_ORDERED],
            ];
        }

        return [
            FormStatus::TO_ORDER->value => [$receivedQuantity >= $quantity ? FormStatus::COMPLETED : FormStatus::ORDERED],
        ];
    }

    public function items() {
        return $this->hasMany(PurchaseRequestItem::class)->with(['item', 'unit']);
    }
}
