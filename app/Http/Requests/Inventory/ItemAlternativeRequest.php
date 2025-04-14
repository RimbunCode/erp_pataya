<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ItemAlternativeRequest extends FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  public function authorize(): bool {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   *
   * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
   */
  public function rules(): array {
    $ruleAlternative = Rule::exists('items', 'id');
    if ($this->has('two_way') && $this->two_way) {
      $ruleAlternative = $ruleAlternative->where('allow_alternative_item', true);
    }
    return [
      'two_way' => ['nullable', 'boolean'],
      'item.id' => ['required', 'string', Rule::exists('items', 'id')->where('allow_alternative_item', true)],
      'alternative.id' => ['required', 'string', $ruleAlternative],
    ];
  }
}
