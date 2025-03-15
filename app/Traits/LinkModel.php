<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait LinkModel {
  protected function getArrayableAppends() {
    $this->appends = array_unique(array_merge($this->appends, \method_exists(static::class, "templateLink") ? ['templateLink'] : []));
    return parent::getArrayableAppends();
  }
  protected function getTemplateLinkAttribute(): string {
    if (!\method_exists(static::class, "templateLink"))
      return "";
    return static::templateLink();
  }
}
