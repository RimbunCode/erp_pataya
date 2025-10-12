<?php

namespace App\Models\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stock extends Model {
  use HasUlids, SoftDeletes;
  protected $guarded = ["id"];
  protected $casts = [
    'stock_queue' => 'array',
  ];
  public static function boot() {
    parent::boot();

    self::saved(function ($model) {
      // auto recalculate valuation rate every update of stock
      $queue = $model->stock_queue;
      $totalQuantity = array_sum(array_column($queue, 'quantity'));

      if ($totalQuantity <= 0) {
        $model->valuation_rate = 0;
      } else {
        $totalQuantity = \array_sum(array_column($queue, 'quantity'));
        $newValuationRate = \array_sum(
          \array_map(fn($q) => $q['rate'] * $q['quantity'], $queue)
        ) / $totalQuantity;

        $model->valuation_rate = $newValuationRate;
      }

      $model->saveQuietly();
    });
  }
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
