<?php

namespace App\Http\Requests\Finances;

use Illuminate\Foundation\Http\FormRequest;

class PaymentEntryRequest extends FormRequest {
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
      'date'                 => ['required', 'date'],
      'paid_amount'          => ['required', 'numeric', 'min:0'],
      'payment_type'         => ['required', 'string', 'in:receive,pay,internal_transfer'],
      'payment_method.id'    => ['nullable', 'exists:payment_methods,id'],
      'party_type'           => ['required_unless:payment_type,internal_transfer', 'string', 'in:customer,supplier'],
      'partyable'            => ['required_unless:payment_type,internal_transfer', 'array'],
      'partyable.id'         => ['required_unless:payment_type,internal_transfer', $this->party_type == 'supplier' ? 'exists:suppliers,id' : 'exists:customers,id'],
      'partyable.*'          => ['nullable'],
      'currency.code'        => ['nullable', 'exists:currencies,code'],
      'currency.*'           => ['nullable'],
      'exchange_rate'        => ['nullable', 'numeric', 'min:0'],
      'paymentable'          => ['required_unless:payment_type,internal_transfer', 'array'],
      'paymentable.id'       => ['required_unless:payment_type,internal_transfer', $this->party_type == 'supplier' ? 'exists:purchase_invoices,id' : 'exists:sales_invoices,id'],
      'account_paid_to.id'   => ['required', 'exists:accounts,id'],
      'account_paid_from.id' => ['required', 'exists:accounts,id'],
      'notes'                => ['nullable', 'string'],
    ];
  }
}
