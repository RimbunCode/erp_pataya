<?php

namespace App\Http\Requests\Finances;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentTermRequest extends FormRequest
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
      'due_date_based_on' => ['required', 'string', 'in:days_after_invoice_date,weeks_after_invoice_date,months_after_invoice_month'],
      'credit_period' => ['required', 'numeric', 'min:0'],
      'invoice_portion' => ['required', 'numeric', 'min:0', 'max:100'],
      'discount_type' => ['nullable', 'string'],
      'discount' => ['nullable', 'numeric', Rule::requiredIf($this->has('discount_type'))],
      'description' => ['nullable', 'string'],
      'payment_method' => ['nullable', 'array'],
      'payment_method.id' => ['nullable', 'exists:payment_methods,id'],
    ];
  }
}
