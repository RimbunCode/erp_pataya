<?php

namespace App\Models\Core;

use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
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


  protected $appends = ['title'];

  public function title(): Attribute {
    return new Attribute(
      get: function ($value) {
        if ($this->is_main_branch) {
          $main = __('core/branch.main');
          return "{$this->name} ({$main})";
        }
        return $this->name;
      }
    );
  }

  public function shippingAddress() {
    return new Attribute(
      get: function ($value) {
        if ($this->is_main_branch) {
          return [
            'street'
          ];
        }
      }
    );
  }

  public static function boot() {
    parent::boot();
    static::addGlobalScope('country', function (Builder $builder) {
      $builder->with(['billingCountry', 'shippingCountry']);
    });
  }

  public static function templateLink() {
    return ":name{:title}";
  }
  protected static function loadRelationsOnShow() {
    return ['shippingCountry', 'billingCountry'];
  }

  public string $formComponent = 'Settings/Branches/Form';

  protected $configColumns = [
    'billingCountry',
    'shippingCountry',
    // 'users',
  ];

  public function billingCountry() {
    return $this->belongsTo(Country::class, 'billing_country_id', 'code');
  }
  public function shippingCountry() {
    return $this->belongsTo(Country::class, 'shipping_country_id', 'code');
  }

  public function users() {
    return $this->belongsToMany(\App\Models\User\User::class, 'user_branches', 'branch_id', 'user_id');
  }

  public function branchable() {
    return $this->morphTo();
  }
}
