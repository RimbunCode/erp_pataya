<?php

namespace App\Http\Requests\Sales;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;

class InternalOrderRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array {
        return [
            'date'                        => ['required', 'date'],
            'external_note'               => ['nullable', 'string'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.id'                  => ['required', 'string'],
            'items.*.item.id'             => ['required', new ExistsExcludingTrashed('item_variants'), 'distinct'],
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'              => ['nullable'],
            'items.*.source_warehouse.id' => ['nullable', 'exists:warehouses,id'],
            'items.*.source_warehouse.*'  => ['nullable'],
        ];
    }
}
