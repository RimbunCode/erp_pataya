<?php

namespace App\Traits;

use App\Models\Core\Country;
use Illuminate\Database\Eloquent\Builder;

trait HasCountry {
  protected static function bootHasCountry() {
    static::addGlobalScope('country', function (Builder $builder) {
      $builder->with('country');
    });
  }

  public function country() {
    return $this->belongsTo(Country::class, 'country_id', 'code');
  }
}
