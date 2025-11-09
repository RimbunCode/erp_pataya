<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class DeliveryNoteRequest extends FormRequest {
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
      'customer.id'                 => ['required', 'exists:customers,id'],
      'customer_branch.id'          => ['required', 'exists:branches,id'],
      'referenceable_id'            => ['required', 'string'],
      'referenceable_type'          => ['required', 'string'],
      'delivery_date'               => ['required', 'date'],
      'items.*'                     => ['required', 'array', 'min:1'],
      'items.*.id'                  => ['required', 'string'],
      'items.*.item.id'             => ['required', 'exists:item_variants,id'],
      'items.*.item.*'              => ['nullable'],
      'items.*.source_warehouse.id' => ['required', 'exists:warehouses,id'],
      'items.*.referenceable_id'    => ['required', 'string'],
      'items.*.referenceable_type'  => ['required', 'string'],
      'items.*.description'         => ['nullable', 'string'],
      'items.*.quantity'            => ['required', 'numeric', 'min:1'],
      'items.*.unit.id'             => ['required', 'exists:units,id'],
      'items.*.unit.*'              => ['nullable'],
    ];
  }
}
