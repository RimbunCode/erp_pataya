<?php

namespace App\Models\Purchase;

use App\Models\Model;
use App\Services\Purchase\PurchaseReceiptService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    /**
     * Panel retur memakai tipe yang sama dengan dokumen ini. Judul di-override
     * supaya tidak tertukar dengan panel penerimaan, dan baris diambil dari
     * returnRows() karena retur tidak tercatat di ModelConnection.
     */
    public static function expectedRelationPanels(): array {
        return [
            self::class => [
                'action' => [
                    'route'      => 'purchaseReceipts.create',
                    'params'     => ['ref' => 'purchaseReceipt/{id}'],
                    'label'      => 'purchase.purchaseReceipt.create_purchase_return',
                    'permission' => 'create',
                ],
                'source' => 'returnRows',
                'title'  => 'purchase.purchaseReceipt.panel.return.title',
            ],
        ];
    }

    /**
     * Dokumen yang meretur dokumen ini (return_against_id menunjuk ke sini).
     */
    public function returns(): HasMany {
        return $this->hasMany(self::class, 'return_against_id');
    }

    /**
     * Query builder untuk panel retur. Builder, bukan koleksi, supaya penjagaan
     * RelationPanelService tetap berlaku.
     */
    public function returnRows(): Builder {
        return $this->returns()->getQuery();
    }

    public static function templateLink() {
        return ':code';
    }

    public $translateKey = 'purchase.purchaseReceipt';

    protected static function loadRelationsOnShow() {
        return ['items', 'items.purchaseOrderItem', 'items.purchaseOrderItem.item', 'items.item', 'items.replacesPurchaseOrderItem', 'items.replacesPurchaseOrderItem.item', 'supplier', 'items.unit', 'items.targetWarehouse', 'purchaseOrder', 'returnAgainst'];
    }

    /**
     * Kolom yang dicari teks bebas Search Bar DataTable2 (chip "Cari") --
     * lihat DataTable::getSearchScope().
     *
     * @var list<string>
     */
    protected static array $searchScope = ['code', 'external_note', 'supplier.name'];

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
            'show'      => true,
            'order'     => 3,
            'groupable' => true,
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

    public static function relationPanel(): array {
        return [
            'title'   => 'purchase.purchaseReceipt.panel.title',
            'columns' => [
                ['key' => 'code', 'label' => 'purchase.purchaseReceipt.panel.code', 'align' => 'left'],
                ['key' => 'date', 'label' => 'purchase.purchaseReceipt.panel.date', 'align' => 'left', 'format' => 'date'],
                ['key' => 'total_quantity', 'label' => 'purchase.purchaseReceipt.panel.quantity', 'align' => 'right', 'format' => 'number', 'aggregate' => 'sum'],
            ],
            'eager' => ['items'],
        ];
    }

    public function relationPanelRow(): array {
        return [
            'code'           => $this->code,
            'date'           => $this->date,
            'total_quantity' => $this->items->sum('quantity'),
        ];
    }

    public static function relationPanelDetail(): array {
        return [
            'columns' => [
                ['key' => 'item', 'label' => 'purchase.purchaseReceipt.columns.item', 'align' => 'left'],
                ['key' => 'quantity', 'label' => 'purchase.purchaseReceipt.columns.quantity', 'align' => 'right', 'format' => 'number'],
            ],
            'eager' => ['items.item'],
        ];
    }

    /**
     * Nama item diambil dari ItemVariant, bukan dari kolom item_name item
     * receipt yang opsional dan sering null.
     */
    public function relationPanelDetailRows(): array {
        return $this->items
            ->map(fn (PurchaseReceiptItem $item): array => [
                'item'     => $item->item?->item_name ?? $item->item_name,
                'quantity' => $item->quantity,
            ])
            ->all();
    }

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
