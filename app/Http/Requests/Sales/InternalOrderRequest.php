<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;

class InternalOrderRequest extends FormRequest
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
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'string'],
            'items.*.item.id' => ['required', 'exists:item_variants,id', 'distinct'],
            'items.*.item.*' => ['nullable'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'numeric', 'min:1'],
            'items.*.unit.id' => ['required', 'exists:units,id'],
            'items.*.unit.*' => ['nullable'],
            'items.*.source_warehouse.id' => ['nullable', 'exists:warehouses,id'],
            'external_note' => ['nullable', 'string'],
        ];
    }
}
