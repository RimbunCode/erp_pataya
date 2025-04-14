<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class FormatVariantValidation implements ValidationRule {
  protected array $attributes;

  public function __construct(array $variants) {
    // Ambil semua nama atribut dari daftar variant
    $this->attributes = array_column(array_column($variants, 'attribute'), 'id', 'name');
  }

  /**
   * Run the validation rule.
   *
   * @param  \Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString  $fail
   */
  public function validate(string $attribute, mixed $value, Closure $fail): void {
    if (!(str_contains($value, "{Item Code}") || str_contains($value, "@[Item Code](item)"))) {
      $fail(":attribute must contain Item Code");
      return;
    }
    // Cek apakah semua atribut disebutkan dalam format_variant
    foreach ($this->attributes as $key => $attr) {
      if (!(str_contains($value, "{{$key}}") || str_contains($value, "@[$key]($attr)"))) {
        $fail(":attribute must contain all attributes: " . implode(', ', \array_keys($this->attributes)));
        return;
      }
    }
  }
}
