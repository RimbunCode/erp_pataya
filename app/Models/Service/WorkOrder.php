<?php

namespace App\Models\Service;

use App\Casts\Json;
use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkOrder extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected $guarded = ['id'];
  protected $casts = [
    "date" => "datetime",
    'address' => Json::class
  ];
  protected $appends = ['for_internal'];
  protected function forInternal(): Attribute {
    return new Attribute(get: fn() => $this->customer_id == null);
  }
  protected static string $defaultFormatCode = '@[branch_code]/WO-@[iiii]/@[yy]';
  public function codeRelations() {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name'
    ];
  }
  public $keyBreadcrumb = "code";

  public function branch() {
    return $this->belongsTo(Branch::class);
  }
  public function items() {
    return $this->hasMany(WorkOrderItem::class)->with(['item', 'unit']);
  }
  public function customer() {
    return $this->belongsTo(Customer::class);
  }
  public function customer_branch() {
    return $this->belongsTo(Branch::class, 'customer_branch_id');
  }
  public function item_service() {
    return $this->belongsTo(ItemVariant::class, 'item_service_id');
  }
  public function source_warehouse() {
    return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
  }
}
