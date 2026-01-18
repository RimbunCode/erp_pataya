<?php

namespace App\Http\Requests\Finances;

use App\Models\Core\Preference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesInvoiceRequest extends FormRequest {
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
    $default_currency = Preference::find('default_currency_id')?->value;

    // dd($default_currency, $this->currency['code']);
    return [
      'date'                                  => ['required', 'date'],
      'sales_order.id'                        => ['nullable', 'exists:sales_orders,id'],
      'sales_order.*'                         => ['nullable'],
      'discount_on'                           => ['nullable', 'in:grand_total,net_total'],
      'discount_rate'                         => ['nullable', 'numeric', 'min:0', 'max:100', Rule::requiredIf($this->has('discount_on'))],
      'discount_amount'                       => ['nullable', 'numeric', 'min:0', Rule::requiredIf($this->has('discount_on'))],
      'currency.code'                         => ['nullable', 'exists:currencies,code'],
      'exchange_rate'                         => ['nullable', Rule::requiredIf($this->currency && $this->currency['code'] != $default_currency), 'numeric'],
      'external_note'                         => ['nullable', 'string'],
      'payment_schedules'                     => ['nullable', 'array'],
      'payment_schedules.*.id'                => ['required', 'string'],
      'payment_schedules.*.payment_term.id'   => ['nullable', 'exists:payment_terms,id'],
      'payment_schedules.*.payment_term.*'    => ['nullable'],
      'payment_schedules.*.payment_method.id' => ['nullable', 'exists:payment_methods,id'],
      'payment_schedules.*.payment_method.*'  => ['nullable'],
      'payment_schedules.*.due_date'          => ['required', 'date'],
      'payment_schedules.*.payment_amount'    => ['required', 'numeric'],
      'payment_schedules.*.discount'          => ['nullable', 'numeric'],
      'payment_schedules.*.discount_type'     => ['nullable', 'in:percentage,amount'],
      'payment_schedules.*.description'       => ['nullable', 'string'],
      'payment_schedules.*.invoice_portion'   => ['required', 'numeric'],

    ];
  }
}
