<?php

namespace App\Http\Requests\Core;

use Illuminate\Foundation\Http\FormRequest;

class BranchRequest extends FormRequest {
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
    return [
      'code' => ['required', 'string', 'max:255'],
      'name' => ['required', 'string', 'max:255'],
      'is_disabled' => ['nullable', 'boolean'],
      'billing_street' => ['nullable', 'string', 'max:255'],
      'billing_city' => ['nullable', 'string', 'max:255'],
      'billing_state' => ['nullable', 'string', 'max:255'],
      'billing_zip_code' => ['nullable', 'string', 'max:255'],
      'billing_country.code' => ['nullable', 'string', 'exists:countries,code'],
      'shipping_street' => ['required', 'string', 'max:255'],
      'shipping_city' => ['required', 'string', 'max:255'],
      'shipping_state' => ['required', 'string', 'max:255'],
      'shipping_zip_code' => ['required', 'string', 'max:255'],
      'shipping_country.code' => ['required', 'string', 'exists:countries,code'],
    ];
  }
}
