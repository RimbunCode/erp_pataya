<?php

namespace App\Models\Core;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use App\Models\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model {
  use HasUlids, DataTable, SoftDeletes;

  protected $guarded = ['id'];
  protected $casts = [
    'is_main_branch' => 'boolean',
    'is_disabled' => 'boolean',
  ];

  public static function boot() {
    parent::boot();
    static::addGlobalScope('country', function (Builder $builder) {
      $builder->with(['billingCountry', 'shippingCountry']);
    });
  }

  public static function templateLink() {
    return ":name";
  }

  public function billingCountry() {
    return $this->belongsTo(Country::class, 'billing_country_id', 'code');
  }
  public function shippingCountry() {
    return $this->belongsTo(Country::class, 'shipping_country_id', 'code');
  }

  public function users() {
    return $this->belongsToMany(\App\Models\User\User::class, 'user_branches', 'branch_id', 'user_id');
  }
}
