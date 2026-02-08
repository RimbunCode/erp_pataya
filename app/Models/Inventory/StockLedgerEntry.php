<?php

namespace App\Models\Inventory;

use App\Models\Core\FormatingSeries;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockLedgerEntry extends Model {
  use HasUlids, SoftDeletes, DataTable;
  protected               $guarded            = ["id"];
  public string           $translateKey       = 'inventories.stockLedgerEntry';
  protected               $configColums       = [
    'quantity_change'            => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 0,
    ],
    'quantity_after_transaction' => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 1,
    ],
    'valuation_rate'             => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 2,
    ],
    'incoming_rate'              => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 3,
    ],
    'outgoing_rate'              => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 4,
    ],
    'balance_stock_value'        => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 5,
    ],
    'change_in_stock_value'      => [
      'type'  => 'numeric',
      'show'  => true,
      'order' => 6,
    ],
    'stock_queue'                => [
      'ignore' => true,
    ],
  ];
  protected               $casts              = [
    'stock_queue' => 'array',
  ];
  protected static string $defaultFormatCode  = 'StockLedger-@[iiii]/@[yy]';
  protected static        $generateCodeSeries = true;

  public static function boot() {
    parent::boot();
    self::creating(function ($model) {
      $model->code = FormatingSeries::get(StockEntry::class, $model->toArray());
    });
  }
}
