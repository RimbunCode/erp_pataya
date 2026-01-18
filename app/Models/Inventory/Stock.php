<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stock extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ["id"];
  protected $casts   = [
    'stock_queue' => 'array',
  ];

  public static function boot() {
    parent::boot();

    self::saved(function ($model) {
      // auto recalculate valuation rate every update of stock
      $queue         = $model->stock_queue;
      $totalQuantity = array_sum(array_column($queue, 'quantity'));

      if ($totalQuantity <= 0) {
        $model->valuation_rate = 0;
      } else {
        $totalQuantity    = \array_sum(array_column($queue, 'quantity'));
        $newValuationRate = \array_sum(
          \array_map(fn($q) => $q['rate'] * $q['quantity'], $queue),
        ) / $totalQuantity;

        $model->valuation_rate = $newValuationRate;
      }

      $model->saveQuietly();
    });
  }
  public string $translateKey  = 'inventories.stock';
  protected     $configColumns = [
    'actual_quantity'    => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 0,
    ],
    'reserved_quantity'  => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 1,
    ],
    'incoming_quantity'  => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 2,
    ],
    'ready_quantity'     => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 3,
    ],
    'projected_quantity' => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 4,
    ],
    'stock_queue'        => [
      'type'   => 'numeric',
      'ignore' => true,
    ],
    'warehouse',
    'itemVariant',
    'unit',
  ];

  public function warehouse() {
    return $this->belongsTo(Warehouse::class);
  }

  public function itemVariant() {
    return $this->belongsTo(ItemVariant::class);
  }

  public function unit() {
    return $this->belongsTo(Unit::class);
  }
}
