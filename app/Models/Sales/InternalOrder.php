<?php

namespace App\Models\Sales;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class InternalOrder extends Model {
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected $guarded = ['id'];
  protected $casts = [
    "date" => "datetime",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/IO-@[iiii]/@[yy]';

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
    return $this->hasMany(InternalOrderItem::class);
  }
  public string $translateKey = "purchase.supplier";
  protected $configColumns = [
    'code' => [
      'isLink' => true,
      'show' => true,
      'order' => 0,
    ],
    'date' => [
      'show' => true,
      'order' => 1,
    ],
    'branch' => [
      'ignore' => true
    ],
  ];
}
