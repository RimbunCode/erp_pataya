<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Services\Inventory\DeliveryNoteService;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNote extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes, Submitable;

    public static string $service = DeliveryNoteService::class;
    public string $formComponent  = 'Inventory/DeliveryNotes/Form';
    protected $guarded            = ['id'];
    protected $casts              = [
        'delivery_date' => 'datetime',
    ];
    protected static string $defaultFormatCode = '@[branch_code]/DN-@[iiii]/@[yy]';

    public function codeRelations() {
        return [
            'branch_code:branch.code',
            'branch_name:branch.name',
        ];
    }

    public $keyBreadcrumb = 'code';

    /**
     * Panel retur memakai tipe yang sama dengan dokumen ini. Judul di-override
     * supaya tidak tertukar dengan panel relasi lain, dan baris diambil dari
     * returnRows() karena retur tidak tercatat di ModelConnection.
     */
    public static function expectedRelationPanels(): array {
        return [
            self::class => [
                'action' => [
                    'route'      => 'deliveryNotes.create',
                    'params'     => ['ref' => 'deliveryNote/{id}'],
                    'label'      => 'inventory.deliveryNote.actions.create_sales_return',
                    'permission' => 'create',
                ],
                'source' => 'returnRows',
                'title'  => 'inventory.deliveryNote.panel.return.title',
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

    public $translateKey = 'inventory.deliveryNote';

    /**
     * Kolom yang dicari teks bebas Search Bar DataTable2 (chip "Cari") --
     * lihat DataTable::getSearchScope().
     *
     * @var list<string>
     */
    protected static array $searchScope = ['code', 'external_note', 'customer.name'];

    protected array $configColumns = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'delivery_date' => [
            'type'  => 'date',
            'show'  => true,
            'order' => 1,
        ],
        'referenceable' => [
            'show'  => true,
            'order' => 2,
        ],
        'customer' => [
            'type'      => 'relation',
            'show'      => true,
            'order'     => 3,
            'groupable' => true,
        ],
        'customerBranch' => [
            'type'               => 'relation',
            'show'               => true,
            'order'              => 4,
            'disabledNavigation' => true,
        ],
        'status' => [
            'show'  => true,
            'order' => 5,
        ],
        'returnAgainst',
        'referenceTo',
        'items' => [
            'show'  => true,
            'order' => 10,
        ],
    ];

    /**
     * Izin tambahan: menambah baris di luar dokumen sumber (ItemVariant/Asset bebas) --
     * harga/pajak baris itu berasal dari input (spec delivery-note-sales-invoice-off-source-items).
     */
    protected static function extraPermissions(): array {
        return ['manage_off_source_items'];
    }

    protected static function loadRelationsOnShow() {
        return [
            'referenceable',
            'referenceTo',
            'customer',
            'customerBranch',
            'items',
            'items.referenceable' => function (MorphTo $morphTo): void {
                $morphTo->morphWith([
                    SalesOrderItem::class    => ['item', 'asset'],
                    InternalOrderItem::class => ['item'],
                ]);
            },
            'items.item',
            'items.unit',
            'items.sourceWarehouse',
            'items.asset',
            'returnAgainst',
        ];
    }

    public function referenceTo() {
        return $this->belongsTo(Permission::class, 'reference_to_id');
    }

    public static function relationPanel(): array {
        return [
            'title'   => 'inventory.deliveryNote.panel.title',
            'columns' => [
                ['key' => 'code', 'label' => 'inventory.deliveryNote.panel.code', 'align' => 'left'],
                ['key' => 'status', 'label' => 'inventory.deliveryNote.panel.status', 'align' => 'left', 'format' => 'status'],
                ['key' => 'total_quantity', 'label' => 'inventory.deliveryNote.panel.quantity', 'align' => 'right', 'format' => 'number', 'aggregate' => 'sum'],
            ],
            'eager' => ['items'],
        ];
    }

    public function relationPanelRow(): array {
        return [
            'code'           => $this->code,
            'status'         => $this->status,
            'total_quantity' => $this->items->sum('quantity'),
        ];
    }

    public function items() {
        return $this->hasMany(DeliveryNoteItem::class);
    }

    public function referenceable() {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }

    public function customer() {
        return $this->belongsTo(Customer::class);
    }

    public function customerBranch() {
        return $this->belongsTo(Branch::class, 'customer_branch_id');
    }

    public function branch() {
        return $this->belongsTo(Branch::class);
    }

    public function returnAgainst() {
        return $this->belongsTo(DeliveryNote::class, 'return_against_id');
    }
}
