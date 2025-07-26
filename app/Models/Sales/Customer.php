<?php

namespace App\Models\Sales;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model {
  use DataTable, SoftDeletes, HasUlids;

  protected $guarded = ['id'];
  protected $casts = [
    'is_disabled' => 'boolean',
  ];
  public static function templateLink() {
    return ":name";
  }
  public function country() {
    return $this->belongsTo(Country::class, 'country_id', 'code');
  }
  public function branches() {
    return $this->morphMany(Branch::class, 'branchable')->orderBy('is_main_branch', 'desc');
  }
}
