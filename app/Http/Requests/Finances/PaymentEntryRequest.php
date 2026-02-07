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
      'payment_method.id'    => ['required', 'exists:payment_methods,id'],
      'payment_type'         => ['required', 'string', 'in:receive,pay'],
      'party_type'           => ['required', 'string', 'in:customer,supplier'],
      'partyable.id'         => ['required', $this->party_type == 'supplier' ? 'exists:suppliers,id' : 'exists:customers,id'],
      'partyable.*'          => ['nullable'],
      'currency.code'        => ['required', 'exists:currencies,code'],
      'currency.*'           => ['nullable'],
      'exchange_rate'        => ['nullable', 'numeric', 'min:0', 'default:0'],
      'description'          => ['nullable', 'string'],
      'paymentable.id'       => ['required', $this->party_type == 'supplier' ? 'exists:purchase_invoices,id' : 'exists:sales_invoices,id'],
      'account_paid_to.id'   => ['required', 'exists:accounts,id'],
      'account_paid_from.id' => ['required', 'exists:accounts,id'],
    ];
  }
}
