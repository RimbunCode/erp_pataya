<?php

namespace App\Http\Requests\Sales;

use App\Models\Core\Preference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesOrderRequest extends FormRequest {
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
      'rental_date.from'                      => [Rule::requiredIf($this->is_rent ?? false), 'date', 'nullable'],
      'rental_date.to'                        => [
        Rule::requiredIf($this->is_rent ?? false),
        Rule::date()->afterOrEqual($this->start_date ?? now()),
        'date',
        'nullable',
      ],
      'is_rent'                               => ['nullable', 'boolean'],
      'customer.id'                           => [Rule::requiredIf(! ($this->is_rent ?? false)), 'exists:customers,id'],
      'customer.*'                            => ['nullable'],
      'customer_branch.id'                    => ['required', 'exists:branches,id'],
      'customer_branch.*'                     => ['nullable'],
      'reference_so.id'                       => ['nullable', 'exists:sales_orders,id'],
      'reference_so.*'                        => ['nullable'],
      'discount_on'                           => ['nullable', 'in:grand_total,net_total'],
      'discount_rate'                         => ['nullable', 'numeric', 'min:0', 'max:100', Rule::requiredIf($this->has('discount_on'))],
      'discount_amount'                       => ['nullable', 'numeric', 'min:0', Rule::requiredIf($this->has('discount_on'))],
      'referenceable_type'                    => ['nullable', 'string'],
      'referenceable_id'                      => ['nullable', 'string'],
      'items'                                 => ['required', 'array', 'min:1'],
      'items.*.id'                            => ['required', 'string'],
      'items.*.item.id'                       => ['required', 'exists:item_variants,id'],
      'items.*.item.*'                        => ['nullable'],
      'items.*.description'                   => ['nullable', 'string'],
      'items.*.quantity'                      => ['required', 'numeric', 'min:1'],
      'items.*.unit.id'                       => ['required', 'exists:units,id'],
      'items.*.unit.*'                        => ['nullable'],
      'items.*.tax.id'                        => ['required', 'exists:taxes,id'],
      'items.*.tax.*'                         => ['nullable'],
      'items.*.price'                         => ['nullable', 'numeric'],
      'items.*.source_warehouse.id'           => ['nullable', 'exists:warehouses,id'],
      'items.*.referenceable_type'            => ['nullable', 'string'],
      'items.*.referenceable_id'              => ['nullable', 'string'],
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
