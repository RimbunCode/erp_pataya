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
  use HasUlids, SoftDeletes, DataTable;
  public $keyBreadcrumb = 'sku';
  public $aliasBreadcrumb = 'Variant';
  protected $guarded = ['id'];
  protected $appends = ['sku'];
  protected $casts = [
    'is_disabled' => 'boolean',
    'allow_alternative_item' => 'boolean',
  ];
  public function sku(): Attribute {
    return new Attribute(
      get: function () {
        return ItemServices::getSku($this);
      }
    );
  }
  public static function templateLink() {
    return "<title>:code - :item_name</title><b>:code</b><br/><span>:item_name</span>";
  }
  public function values() {
    return $this->hasMany(ItemVariantAttribute::class, 'item_variant_id', 'id');
  }
  public function item() {
    return $this->belongsTo(Item::class, 'item_id', 'id');
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
        $warehouses = Warehouse::with(['stocks' => fn($query) => $query->where('item_variant_id', $this->id), 'stocks.unit', 'branch']);
        if (Session::has('currentBranch')) {
          $branch = Branch::find(Session::get('currentBranch'));
          if (!$branch->is_main_branch) {
            $warehouses->where('warehouses.branch_id', $branch->id);
          }
        }
        $warehouses = $warehouses->get()
          ->map(fn($warehouse) => [
            ...$warehouse->toArray(),
            'actual_stock' => $warehouse->stocks->sum('quantity'),
            'reserved_stock' => 0,
          ]);
        return $warehouses;
      })
    ]);
  }
  public function barcodes() {
    return $this->hasMany(ItemBarcode::class, 'item_variant_id', 'id');
  }
}
