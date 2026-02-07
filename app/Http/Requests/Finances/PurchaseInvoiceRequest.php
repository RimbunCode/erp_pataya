<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Models\Core\Preference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PurchaseInvoiceRequest extends FormRequest {
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
      'date'                        => ['required', 'date'],
      'purchase_order.id'           => ['nullable', 'exists:purchase_orders,id'],
      'purchase_order.*'            => ['nullable'],
      'items'                       => ['required', 'array', 'min:1'],
      'items.*.id'                  => ['required', 'string'],
      'items.*.item.id'             => ['required', 'exists:item_variants,id'],
      'items.*.item.*'              => ['nullable'],
      'items.*.description'         => ['nullable', 'string'],
      'items.*.referenceable_type'  => ['nullable', 'string'],
      'items.*.referenceable_id'    => ['nullable', 'string'],
      'items.*.quantity'            => ['required', 'numeric', 'min:1'],
      'items.*.unit.id'             => ['required', 'exists:units,id'],
      'items.*.unit.*'              => ['nullable'],
      'items.*.target_warehouse.id' => ['required', 'exists:warehouses,id'],
      'items.*.target_warehouse.*'  => ['nullable'],
      'items.*.tax.id'              => ['nullable', 'exists:taxes,id'],
      'items.*.tax.*'               => ['nullable'],
      'items.*.rate'                => ['required', 'numeric', 'min:0'],
      'supplier.id'                 => ['required', 'exists:suppliers,id'],
      'supplier.*'                  => ['nullable'],
      'currency.code'               => ['nullable', 'exists:currencies,code'],
      'exchange_rate'               => ['nullable', Rule::requiredIf($this->currency && $this->currency['code'] != $default_currency), 'numeric'],
      'external_note'               => ['nullable', 'string'],
      ...AdditionalDiscountRules::make($this),
      ...PaymentSchedulesRules::make($this),
    ];
  }
}
