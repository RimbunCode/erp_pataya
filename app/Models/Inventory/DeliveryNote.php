<?php

namespace App\Models\Inventory;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\Permission;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Database\Seeders\PermissionSeeder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNote extends Model {
  use DataTable, HasUlids, SoftDeletes, Submitable;
  protected               $guarded           = ['id'];
  protected               $casts             = [
    "delivery_date" => "datetime",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/DN-@[iiii]/@[yy]';

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
  public    $translateKey  = 'inventory.deliveryNote';
  protected $configColumns = [
    'code'            => [
      'isLink' => true,
      'show'   => true,
      'order'  => 0,
    ],
    'delivery_date'   => [
      'type'  => 'date',
      'show'  => true,
      'order' => 1,
    ],
    'referenceable'   => [
      'show'  => true,
      'order' => 2,
    ],
    'customer'        => [
      'type'  => 'relation',
      'show'  => true,
      'order' => 3,
    ],
    'customer_branch' => [
      'type'  => 'relation',
      'show'  => true,
      'order' => 4,
    ],
    'status'          => [
      'show'  => true,
      'order' => 5,
    ],
    'returnAgainst',
  ];

  protected static function loadRelationsOnShow() {
    return [
      'referenceable',
      'model',
      'customer',
      'customer_branch',
      'items',
      'items.unit',
      'items.item',
      'items.sourceWarehouse',
      'returnAgainst',
    ];
  }

  public function model() {
    return Permission::where('model', "=", $this->referenceable_type)->first();
  }

  public function items() {
    return $this->hasMany(DeliveryNoteItem::class);
  }

  public function referenceable() {
    return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
  }

  public function customer() {
    return $this->belongsTo(Customer::class);
  }

  public function customer_branch() {
    return $this->belongsTo(Branch::class, 'customer_branch_id');
  }

  public function branch() {
    return $this->belongsTo(Branch::class);
  }

  public function returnAgainst() {
    return $this->belongsTo(DeliveryNote::class, 'return_against_id');
  }
}
