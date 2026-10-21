<?php

namespace App\Models\Sales;

use App\Models\Core\Branch;
use App\Models\Inventory\DeliveryNote;
use App\Models\Model;
use App\Services\Sales\InternalOrderService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class InternalOrder extends Model {
    use DataTable, HasUlids, SoftDeletes, Submitable;

    public static string $service = InternalOrderService::class;
    public string $formComponent  = 'Sales/InternalOrders/Form';
    protected $guarded            = ['id'];
    protected $casts              = [
        'date' => 'datetime',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/IO-@[iiii]/@[yy]';

    /**
     * Aksi sama dengan tombol di Sales/InternalOrders/Show.jsx.
     */
    public static function expectedRelationPanels(): array {
        return [
            DeliveryNote::class => [
                'action' => [
                    'route'      => 'deliveryNotes.create',
                    'params'     => ['ref' => 'internalOrder/{id}'],
                    'label'      => 'sales.internalOrder.actions.create_delivery_note',
                    'permission' => 'create',
                ],
            ],
        ];
    }

    public static function templateLink() {
        return ':code';
    }

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    protected static function loadRelationsOnShow() {
        return [
            'items',
            'items.item',
            'items.unit',
            'items.sourceWarehouse',
        ];
    }

    public static function relationPanel(): array {
        return [
            'title'   => 'sales.internalOrder.panel.title',
            'columns' => [
                ['key' => 'code', 'label' => 'sales.internalOrder.panel.code', 'align' => 'left'],
                ['key' => 'status', 'label' => 'sales.internalOrder.panel.status', 'align' => 'left', 'format' => 'status'],
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
        return $this->hasMany(InternalOrderItem::class);
    }

    public string $translateKey = 'sales.internalOrder';

    /**
     * Kolom yang dicari teks bebas Search Bar DataTable2 (chip "Cari") --
     * lihat DataTable::getSearchScope().
     *
     * @var list<string>
     */
    protected static array $searchScope = ['code', 'branch.name', 'created_by.name'];

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
        'status' => [
            'show'  => true,
            'order' => 2,
        ],
        'branch',
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];
}
