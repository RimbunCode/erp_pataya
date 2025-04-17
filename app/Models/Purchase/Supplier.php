<?php

namespace App\Models\Purchase;

use App\Casts\FormTable;
use App\Models\Core\Country;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model {
  use HasUlids, SoftDeletes, DataTable;

  protected $guarded = ['id'];

  protected $casts = [
    'is_disabled' => 'boolean',
    'banks' => FormTable::class
  ];
  public function country() {
    return $this->belongsTo(Country::class, 'country_id', 'code');
  }
}
