<?php

namespace App\Models\Sales;

use App\Models\Inventory\DeliveryNote;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesReturn extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected               $guarded           = ['id'];
  protected               $casts             = [
    "return_date" => "datetime",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/SR-@[iiii]/@[yy]';

  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name',
    ];
  }
  public $keyBreadcrumb = "code";

  public static function templateLink() {
    return ":code";
  }
  public    $translateKey  = 'sales.salesReturn';
  protected $configColumns = [
    'code'          => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'sales_order'   => [
      'show'  => true,
      'order' => 1,
    ],
    'delivery_note' => [
      'show'  => true,
      'order' => 2,
    ],
    'return_date'   => [
      'show'  => true,
      'order' => 3,
    ],
    'status'        => [
      'show'  => true,
      'order' => 4,
    ],
    'branch'        => [
      'ignore' => true,
    ],
  ];

  protected static function loadRelationsOnShow() {
    return [
      'delivery_note',
      'items',
      'items.item',
      'items.unit',
      'items.sourceWarehouse',
      'items.targetWarehouse',
    ];
  }

  public function items() {
    return $this->hasMany(SalesReturnItem::class);
  }

  public function sales_order() {
    return $this->belongsTo(SalesOrder::class, 'sales_order_id');
  }

  public function delivery_note() {
    return $this->belongsTo(DeliveryNote::class, 'delivery_note_id');
  }
}
