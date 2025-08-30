<?php

namespace App\Models\Sales;

use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Model;
use App\Traits\DataTable;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrder extends Model
{
  use DataTable, Submitable, HasUlids, SoftDeletes;
  protected $guarded = ['id'];
  protected $casts = [
    "date" => "datetime",
    "is_rent" => "boolean",
  ];
  protected static string $defaultFormatCode = '@[branch_code]/SO-@[iiii]/@[yy]';
  public function codeRelations()
  {
    return [
      'branch_code:branch.code',
      'branch_name:branch.name'
    ];
  }
  public $keyBreadcrumb = "code";

  public static function templateLink()
  {
    return ":name (:code)";
  }

  public function items()
  {
    return $this->hasMany(SalesOrderItem::class);
  }

  public function customer()
  {
    return $this->belongsTo(Customer::class);
  }

  public function customer_branch()
  {
    return $this->belongsTo(Branch::class, 'customer_branch_id');
  }

  public function branch()
  {
    return $this->belongsTo(Branch::class);
  }

  public function currency()
  {
    return $this->belongsTo(Currency::class, 'currency_code');
  }
}
