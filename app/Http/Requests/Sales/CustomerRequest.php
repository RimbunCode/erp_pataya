<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;

class CustomerRequest extends FormRequest
{
  /**
   * Determine if the user is authorized to make this request.
   */
  public function authorize(): bool
  {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   *
   * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
   */
  public function rules(): array
  {
    return [
      'name' => ['required', 'string', 'min:3', 'max:255'],
      'phone' => ['required', 'string', 'min:3', 'max:255'],
      'email' => ['required', 'string', 'min:3', 'max:255'],
      'vat' => ['required', 'string', 'min:3', 'max:255'],
      'street' => ['required', 'string', 'min:3', 'max:255'],
      'is_disabled' => ['nullable', 'boolean'],
      'is_internal' => ['nullable', 'boolean'],
    ];
  }
}
