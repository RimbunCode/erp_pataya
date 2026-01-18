<?php

namespace App\Http\Requests\Finances;

use Illuminate\Foundation\Http\FormRequest;

class PaymentEntryRequest extends FormRequest
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
      'date' => ['required', 'date'],
      'paid_amount' => ['required', 'numeric', 'min:0'],
      'payment_method.id' => ['required', 'exists:payment_methods,id'],
      'payment_type' => ['required', 'string', 'in:receive,pay'],
      'partyable.id' => ['required', $this->payment_type == 'pay' ? 'exists:suppliers,id' : 'exists:customers,id'],
      'partyable.*' => ['nullable'],
      'partyable_type' => ['required', 'string'],
      'currency.code' => ['required', 'exists:currencies,code'],
      'currency.*' => ['nullable'],
      'exchange_rate' => ['required', 'numeric', 'min:0'],
      'description' => ['nullable', 'string'],
      'paymentable_id' => ['required', 'string'],
      'paymentable_type' => ['required', 'string'],
    ];
  }
}
