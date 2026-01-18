<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesReturnRequest extends FormRequest {
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
      'return_date'                   => ['required', 'date'],
      'delivery_note.id'              => ['required', 'exists:delivery_notes,id'],
      'delivery_note.*'               => ['nullable'],
      'type'                          => ['required', 'string'],
      'external_note'                 => ['nullable', 'string'],
      'items'                         => ['required', 'array', 'min:1'],
      'items.*.id'                    => ['required', 'string'],
      'items.*.item.id'               => ['required', 'exists:item_variants,id'],
      'items.*.item.*'                => ['nullable'],
      'items.*.delivery_note_item_id' => ['required', 'exists:delivery_note_items,id'],
      'items.*.description'           => ['nullable', 'string'],
      'items.*.quantity'              => ['required', 'numeric', 'min:1'],
      'items.*.unit.id'               => ['required', 'exists:units,id'],
      'items.*.unit.*'                => ['nullable'],
      'items.*.conversion_factor'     => ['nullable', 'numeric', 'min:0'],
      'items.*.source_warehouse.id'   => ['nullable', Rule::requiredIf($this->type == 'replace'), 'exists:warehouses,id'],
      'items.*.target_warehouse.id'   => ['required', 'exists:warehouses,id'],
    ];
  }
}
