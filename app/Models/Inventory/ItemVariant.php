<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Services\Inventory\ItemServices;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemVariant extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public $keyBreadcrumb       = 'sku';
    public $aliasBreadcrumb     = 'Variant';
    public string $translateKey = 'inventories.itemVariant';
    protected $guarded          = ['id'];
    protected $casts            = [
        'is_disabled'            => 'boolean',
        'allow_alternative_item' => 'boolean',
        'is_stock_item'          => 'boolean',
    ];
    protected $appends = ['sku'];

    public function sku(): Attribute {
        return new Attribute(
            get: function () {
                return ItemServices::getSku($this);
            },
        );
    }

    protected static function loadRelationsOnShow() {
        return [
            'values',
            'category',
            'item',
            'defaultUnit',
            'barcodes',
        ];
    }

    protected $configColumns = [
        'code' => [
            'show'  => true,
            'order' => 0,
        ],
        'item_code' => [
            'show'  => true,
            'order' => 1,
        ],
        'item_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'is_disabled' => [
            'type'  => 'boolean',
            'show'  => true,
            'order' => 3,
        ],
        'is_stock_item' => [
            'type'  => 'boolean',
            'show'  => true,
            'order' => 4,
        ],
        'values',
        'item',
        'stocks',
        'uom',
        'defaultUnit',
        'category',
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

    public function uom() {
        return $this->hasMany(ItemUnit::class, 'item_id', 'id');
    }

    public function category() {
        return $this->belongsTo(Category::class);
    }

    public function showStocks() {
        Inertia::share([
            'stocks' => Inertia::defer(function () {
                $warehouses = Warehouse::select([
                    'warehouses.*',
                    'stocks.id as stock_id',
                    'stocks.quantity',
                    'stocks.actual_quantity',
                    'stocks.rented_quantity',
                    'stocks.reserved_quantity',
                    'stocks.incoming_quantity',
                    'stocks.projected_quantity',
                    'stocks.ready_quantity',
                    'stocks.ready_quantity',
                    'stocks.valuation_rate',
                ])
                    ->leftJoin('stocks', 'stocks.warehouse_id', '=', 'warehouses.id')
                    ->where('item_variant_id', $this->id);
                if (Session::has('currentBranch')) {
                    $branch = Branch::find(Session::get('currentBranch'));
                    if (! $branch->is_main_branch) {
                        $warehouses->where('warehouses.branch_id', $branch->id);
                    }
                }
                $warehouses = $warehouses->get();

                return $warehouses;
            }),
        ]);
    }

    public function barcodes() {
        return $this->hasMany(ItemBarcode::class, 'item_variant_id', 'id')
            ->with(['unit']);
    }
}
