<?php

namespace App\Casts;

use App\FormStatus;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class FormStatusCast implements CastsAttributes {
  /**
   * Cast the given value.
   *
   * @param  array<string, mixed>  $attributes
   */
  public function get(Model $model, string $key, mixed $value, array $attributes): mixed {
    if ($value == null) return null;
    return FormStatus::from($value);
  }

  /**
   * Prepare the given value for storage.
   *
   * @param  array<string, mixed>  $attributes
   */
  public function set(Model $model, string $key, mixed $value, array $attributes): mixed {
    if ($value instanceof FormStatus) {
      return $value->value;
    }
    throw new InvalidArgumentException("The given value is not an instance of FormStatus");
  }
}
