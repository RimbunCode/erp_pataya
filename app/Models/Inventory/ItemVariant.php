<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemVariant extends Model {
    use DataTable, HasUlids, SoftDeletes;
    public        $keyBreadcrumb   = 'code';
    public        $aliasBreadcrumb = 'Variant';
    public string $translateKey    = 'inventory.item';
    protected     $guarded         = ['id'];
    protected     $casts           = [
        'is_disabled'            => 'boolean',
        'allow_alternative_item' => 'boolean',
        'is_stock_item'          => 'boolean',
    ];

    // protected $appends = ['sku'];

    // public function sku(): Attribute {
    //     return new Attribute(
    //         get: function () {
    //             return ItemServices::getSku($this);
    //         },
    //     );
    // }

    protected static function loadRelationsOnShow() {
        return [
            'values',
            'category',
            'item',
            'defaultUnit',
            'barcodes',
            'uoms',
        ];
    }

    protected function getImageAttribute() {
        return $this->image_id ?? null;
    }
    protected     $configColumns = [
        'image'         => [
            'show'  => true,
            'order' => 0,
            'type'  => 'image',
            'width' => 'fit',
        ],
        'code'          => [
            'show'  => true,
            'order' => 0,
        ],
        'item_code'     => [
            'show'  => true,
            'order' => 1,
        ],
        'item_name'     => [
            'show'  => true,
            'order' => 2,
        ],
        'is_disabled'   => [
            'type'  => 'boolean',
            'show'  => true,
            'order' => 3,
        ],
        'is_stock_item' => [
            'type'  => 'boolean',
            'show'  => true,
            'order' => 4,
        ],
        'image_id'      => [
            'ignore' => true,
        ],
        'values',
        'item',
        'stocks',
        'uoms',
        'defaultUnit',
        'category',
        'defaultUom'    => [
            'ignore' => true,
        ],
    ];
    public string $formComponent = 'Inventory/Items/FormVariant';

    public static function templateLink() {
        return '<title>:code - :item_name</title><b>:code</b><br/><span>:item_name</span>';
    }

    public function values() {
        return $this->hasMany(ItemVariantAttribute::class, 'item_variant_id', 'id');
    }

    public function item() {
        return $this->belongsTo(Item::class, 'item_id', 'id')
            ->with(['category', 'defaultUnit']);
    }

    public function stocks() {
        return $this->hasMany(Stock::class, 'item_variant_id', 'id');
    }

    public function defaultUnit() {
        return $this->belongsTo(Unit::class, 'default_unit_id');
    }

    public function defaultUom() {
        $itemUnitTable    = (new ItemUnit)->getTable();
        $itemVariantTable = $this->getTable();

        return $this->hasOne(ItemUnit::class, 'item_id', 'item_id')
            ->join("{$itemVariantTable} as default_uom_item_variants", 'default_uom_item_variants.item_id', '=', "{$itemUnitTable}.item_id")
            ->whereColumn("{$itemUnitTable}.unit_id", 'default_uom_item_variants.default_unit_id')
            ->select("{$itemUnitTable}.*");
    }

    public function uoms() {
        return $this->hasMany(ItemUnit::class, 'item_id', 'item_id');
    }

    public function category() {
        return $this->belongsTo(Category::class);
    }

    public function showStocks() {
        Inertia::share([
            'stocks' => Inertia::defer(function () {
                $warehouses = Warehouse::with([
                    'stocks' => fn ($query) => $query->where('item_variant_id', $this->id),
                    'stocks.unit',
                    'branch',
                ]);
                if (Session::has('currentBranch')) {
                    $branch = Branch::find(Session::get('currentBranch'));
                    if (! $branch->is_main_branch) {
                        $warehouses->where('warehouses.branch_id', $branch->id);
                    }
                }
                $warehouses = $warehouses->get()
                    ->map(fn (Warehouse $warehouse) => [
                        ...$warehouse->toArray(),
                        'actual_stock'   => $warehouse->stocks->sum('quantity'),
                        'reserved_stock' => 0,
                    ]);

                return $warehouses;
            }),
        ]);
    }

    public function barcodes() {
        return $this->hasMany(ItemBarcode::class, 'item_variant_id', 'id');
    }
}
