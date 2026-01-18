<?php

namespace App\Models\Inventory;

use App\Models\Model;
use App\Models\Sales\SalesOrder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNoteItem extends Model {
  use HasUlids, SoftDeletes;
  protected     $guarded       = ['id'];
  public string $translateKey  = 'finances.deliveryNoteItem';
  protected     $configColumns = [
    'quantity'    => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 0,
    ],
    'description' => [
      'show'  => true,
      'order' => 1,
    ],
    'referenceable',
    'sourceWarehouse',
    'item',
  ];
  protected $casts   = [
    'valuation_rates' => 'array',
  ];

  public function referenceable() {
    return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
  }

  public function sourceWarehouse() {
    return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
  }

  public function item() {
    return $this->belongsTo(ItemVariant::class, 'item_id');
  }

  public function deliveryNote() {
    return $this->belongsTo(DeliveryNote::class);
  }

  public function unit() {
    return $this->belongsTo(Unit::class);
  }

  public function returnAgainstItem() {
    return $this->belongsTo(DeliveryNoteItem::class, 'return_against_item_id');
  }
}
