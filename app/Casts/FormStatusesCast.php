<?php

namespace App\Casts;

use App\FormStatus;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class FormStatusesCast implements CastsAttributes {
  /**
   * Cast the given value.
   *
   * @param  array<string, mixed>  $attributes
   */
  public function get(Model $model, string $key, mixed $value, array $attributes): mixed {
    if ($value == null)

      return null;
    $split = \explode(",", $value);
    return \array_map(function ($item) {
      if ($item == null) return null;

      return FormStatus::from($item);
    }, $split);
  }

  /**
   * Prepare the given value for storage.
   *
   * @param  array<string, mixed>  $attributes
   */
  public function set(Model $model, string $key, mixed $value, array $attributes): mixed {
    if (! \is_array($value)) {
      if (! $value instanceof FormStatus)
        throw new InvalidArgumentException("The given value is not an instance of FormStatus");
      $model->setAttribute($key, [$value]);
      return $value->value;
    }

    $statuses = \array_map(function ($item) {
      if ($item == null) return null;
      if (! $item instanceof FormStatus)
        throw new InvalidArgumentException("The given value is not an instance of FormStatus");
      return $item->value;
    }, $value);

    return \implode(",", \array_filter($statuses, fn ($item) => $item != null));

  }
}
