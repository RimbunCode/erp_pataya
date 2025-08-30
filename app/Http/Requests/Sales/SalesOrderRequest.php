<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesOrderRequest extends FormRequest
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
    // dd($this->all());
    return [
      'date' => ['required', 'date'],
      'start_date' => [Rule::requiredIf($this->is_rent ?? false), 'date', 'nullable'],
      'end_date' => [
        Rule::requiredIf($this->is_rent ?? false),
        Rule::date()->afterOrEqual($this->start_date ?? now()),
        'date',
        'nullable'
      ],
      'is_rent' => ['nullable', 'boolean'],
      'customer.id' => [Rule::requiredIf(!($this->is_rent ?? false)), 'exists:customers,id'],
      'customer.*' => ['nullable'],
      'customer_branch.id' => ['required', 'exists:branches,id'],
      'customer_branch.*' => ['nullable'],
      'reference_so.id' => ['nullable', 'exists:sales_orders,id'],
      'reference_so.*' => ['nullable'],
      'items' => ['required', 'array', 'min:1'],
      'items.*.id' => ['required', 'string'],
      'items.*.item.id' => ['required', 'exists:item_variants,id'],
      'items.*.item.*' => ['nullable'],
      'items.*.description' => ['nullable', 'string'],
      'items.*.quantity' => ['required', 'numeric', 'min:1'],
      'items.*.unit.id' => ['required', 'exists:units,id'],
      'items.*.unit.*' => ['nullable'],
      'items.*.tax.id' => ['required', 'exists:taxes,id'],
      'items.*.tax.*' => ['nullable'],
      'items.*.price' => ['nullable', 'numeric'],
      'items.*.source_warehouse.id' => ['nullable', 'exists:warehouses,id'],
      'currency.code' => ['nullable', 'exists:currencies,code'],
      'exchange_rate' => [Rule::requiredIf($this->currency), 'numeric'],
      'external_note' => ['nullable', 'string'],
    ];
  }
}
