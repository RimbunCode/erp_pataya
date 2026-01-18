<?php

namespace App\Http\Requests\Purchase;

use App\Models\Core\Preference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PurchaseOrderRequest extends FormRequest {
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
      'date'                                  => ['required', 'date'],
      'required_date'                         => ['required', 'date', Rule::date()->afterOrEqual($this->date)],
      'external_note'                         => ['nullable', 'string'],
      'supplier.id'                           => ['required', 'exists:suppliers,id'],
      'supplier.*'                            => ['nullable'],
      'exchange_rate'                         => ['nullable', Rule::requiredIf($this->currency && $this->currency['code'] != $default_currency), 'numeric'],
      'currency.code'                         => ['nullable', 'exists:currencies,code'],
      'currency.*'                            => ['nullable'],
      'items'                                 => ['required', 'array', 'min:1'],
      'items.*.id'                            => ['required', 'string'],
      'items.*.item.id'                       => ['required', 'exists:item_variants,id'],
      'items.*.item.*'                        => ['nullable'],
      'items.*.description'                   => ['nullable', 'string'],
      'items.*.referenceable_type'            => ['nullable', 'string'],
      'items.*.referenceable_id'              => ['nullable', 'string'],
      'items.*.required_date'                 => ['required', 'date', Rule::date()->afterOrEqual($this->date)],
      'items.*.quantity'                      => ['required', 'numeric', 'min:1'],
      'items.*.unit.id'                       => ['required', 'exists:units,id'],
      'items.*.unit.*'                        => ['nullable'],
      'items.*.target_warehouse.id'           => ['required', 'exists:warehouses,id'],
      'items.*.target_warehouse.*'            => ['nullable'],
      'items.*.tax.id'                        => ['nullable', 'exists:taxes,id'],
      'items.*.tax.*'                         => ['nullable'],
      'items.*.rate'                          => ['required', 'numeric', 'min:0'],
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
