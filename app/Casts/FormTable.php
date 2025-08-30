<?php

namespace App\Casts;

use App\Utils;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class FormTable implements CastsAttributes {
  /**
   * Cast the given value.
   *
   * @param  array<string, mixed>  $attributes
   */
  public function get(Model $model, string $key, mixed $value, array $attributes): array {
    if (!isset($value) || $value == null) {
      return [];
    }
    $value = json_decode($value, true);
    $value = \array_map(function ($value) {
      if (!isset($value['id'])) $value['id'] = Utils::generateRandom(8);
      return $value;
    }, $value);
    return $value;
  }

  /**
   * Prepare the given value for storage.
   *
   * @param  array<string, mixed>  $attributes
   */
  public function set(Model $model, string $key, mixed $value, array $attributes): mixed {
    if ($value == null) {
      return null;
    }
    $value = \array_values(\array_filter($value, function ($value) {
      // Ambil key yang memiliki nilai (tidak null, tidak false, tidak string kosong)
      $validValues = array_filter($value, function ($value, $key) {
        if ($key == 'id') return false;
        return !empty($value); // `empty()` akan mengecek null, false, '' (string kosong), dan array kosong
      }, ARRAY_FILTER_USE_BOTH);
      return count($validValues) > 0;
    }, ARRAY_FILTER_USE_BOTH));
    return json_encode($value);
  }
}
