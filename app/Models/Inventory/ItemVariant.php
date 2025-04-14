<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemVariant extends Model {
  use HasUlids, SoftDeletes, DataTable;
  public $valueBreadcrumb = 'sku';
  public $aliasBreadcrumb = 'Variant';
  protected $guarded = ['id'];
  protected $appends = ['sku'];
  protected $casts = [
    'is_disabled' => 'boolean',
    'allow_alternative_item' => 'boolean',
  ];
  public function sku(): Attribute {
    return new Attribute(
      get: function ($value) {
        if ($this->format_variant === null || $this->format_variant === '') {
          return null;
        }
        $data = array_combine(array_column($this->values->toArray(), 'attribute_id'), array_column($this->values->toArray(), 'value'));
        $data['item'] = $this->item_code ?? $this->item->code;
        $result = preg_replace_callback('/@\[(.*?)\]\((.*?)\)/', function ($matches) use ($data) {
          $key = $matches[1];
          $id = $matches[2];
          return $data[$key] ?? ($data[$id] ?? $matches[0]);
        }, $this->format_variant ?? $this->item->format_variant);
        return $result;
      }
    );
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
