<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttributeRequest extends FormRequest {
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
    $values = $this->is_numeric ? [
      'from_range' => ['required', 'numeric'],
      'to_range' => ['required', 'numeric'],
      'increment' => ['required', 'numeric']
    ] : [
      'values' => ['required', 'array', 'min:1'],
      'values.*.value' => ['required', 'string', 'min:3', 'max:255', 'distinct']
    ];
    return [
      'name' => [
        'required',
        'string',
        'min:3',
        'max:255',
        Rule::unique('attributes')->whereNull('deleted_at')->ignore($this->id)
      ],
      'description' => ['nullable', 'string'],
      'is_numeric' => ['nullable', 'boolean'],
      ...$values
    ];
  }
}
