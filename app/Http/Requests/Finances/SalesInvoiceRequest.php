<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
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

    return [
      'date'                           => ['required', 'date'],
      'sales_order.id'                 => ['nullable', 'exists:sales_orders,id'],
      'sales_order.*'                  => ['nullable'],
      'return_against.id'              => ['nullable', 'exists:sales_invoices,id'],
      'income_account.id'              => ['required', 'exists:accounts,id'],
      'debit_account.id'               => ['required', 'exists:accounts,id'],
      'customer.id'                    => ['required', 'exists:customers,id'],
      'customer.*'                     => ['nullable'],
      'customer_branch.id'             => ['required', 'exists:branches,id'],
      'customer_branch.*'              => ['nullable'],
      'items'                          => ['required', 'array', 'min:1'],
      'items.*.id'                     => ['required', 'string'],
      'items.*.item.id'                => ['required', 'exists:item_variants,id'],
      'items.*.item.*'                 => ['nullable'],
      'items.*.description'            => ['nullable', 'string'],
      'items.*.quantity'               => ['required', 'numeric', 'min:1'],
      'items.*.unit.id'                => ['required', 'exists:units,id'],
      'items.*.unit.*'                 => ['nullable'],
      'items.*.tax.id'                 => ['required', 'exists:taxes,id'],
      'items.*.tax.*'                  => ['nullable'],
      'items.*.price'                  => ['nullable', 'numeric'],
      'items.*.sales_order_item_id'    => ['nullable', 'exists:sales_order_items,id'],
      'items.*.return_against_item_id' => ['nullable', 'exists:sales_invoice_items,id'],
      'currency.code'                  => ['nullable', 'exists:currencies,code'],
      'exchange_rate'                  => ['nullable', Rule::requiredIf($this->currency && $this->currency['code'] != $default_currency), 'numeric'],
      'external_note'                  => ['nullable', 'string'],
      ...AdditionalDiscountRules::make($this),
      ...PaymentSchedulesRules::make($this),

    ];
  }
}
