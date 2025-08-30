<?php

namespace App\Models\Inventory;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Item extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  protected $casts = [
    'is_disabled' => 'boolean',
    'allow_alternative_item' => 'boolean',
  ];

  public static function templateLink() {
    return "<title>:code - :name</title><b>:code</b><br/><span>:name</span>";
  }

  protected static function loadRelationsOnShow() {
    return [
      'attributes',
      'category',
      'defaultUnit',
      // 'uom',
      'uoms',
      'variants',
      'barcodes',
    ];
  }
  public string $formComponent = 'Inventory/Items/Form';
  protected $configColumns = [
    'attributes',
    'defaultUnit',
    // 'uom' => function ($builder, $value){

    // },
    'variants',
    'category',
  ];

  public function attributes() {
    return $this->hasMany(ItemAttribute::class)->with(['attribute']);
  }

  public function defaultUnit() {
    return $this->belongsTo(Unit::class, 'default_unit_id');
  }
  public function uom() {
    return $this->hasMany(ItemUnit::class, 'item_id', 'id')->with(['unit']);
  }
  protected function barcodes() {
    $variant = $this->variants
      ->whereNull('format_variant')
      ->first();
    if ($variant) {
      return $variant->barcodes()->with(['unit'])->get();
    }
  }

  protected function uoms() {
    $uom = Unit::joinSub(
      DB::table(Unit::getTableName())
        ->select("group")
        ->where('id', $this->default_unit_id)
        ->limit(1),
      "target_group",
      function ($join) {
        $join->on('units.group', '=', 'target_group.group');
      }
    )
      ->selectRaw('*,ISNULL(`conversion_factor`) AS `isCustom`')
      ->get();
    $uomIds = $this->uom->pluck('unit_id');
    return $uom->map(function (Unit $uom) use ($uomIds) {
      $uom->isCustom = $uom->isCustom == 1;
      $uom->readOnly = $uom->isCustom == 0;
      if (\in_array($uom->id, $uomIds->toArray())) {
        $uom->conversion_factor = $this->uom->where('unit_id', $uom->id)->first()->conversion_factor;
      }
      return $uom;
    })->reject(fn(Unit $uom) => $uom->isCustom && $uom->conversion_factor == null);
  }
  public function category() {
    return $this->belongsTo(Category::class);
  }
  public function variants() {
    return $this->hasMany(ItemVariant::class, 'item_id', 'id');
  }
}
