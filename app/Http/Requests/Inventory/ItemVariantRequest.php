<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class ItemVariantRequest extends FormRequest
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
        return [
            'is_disabled' => ['nullable', 'boolean'],
            'allow_alternative_item' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string'],
            'barcodes' => ['nullable', 'array'],
            'barcodes.*.barcode' => ['required', 'string', 'min:3', 'max:255'],
            'barcodes.*.unit.id' => ['required', 'string', 'exists:units,id'],
        ];
    }
}
