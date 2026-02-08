<?php

namespace App\Http\Requests\Inventory;

use App\Rules\FormatVariantValidation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ItemRequest extends FormRequest
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
            'code' => [
                'required',
                'string',
                'min:3',
                'max:255',
                'regex:/^[\w\-\.]*$/',
                Rule::unique('items')->whereNull('deleted_at')->ignore($this->id),
            ],
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'description' => ['nullable', 'string'],
            'category.id' => ['required', 'string', 'exists:categories,id'],
            'default_unit.id' => ['required', 'string', 'exists:units,id'],
            'is_disabled' => ['nullable', 'boolean'],
            'allow_alternative_item' => ['nullable', 'boolean'],
            'uoms' => ['required', 'array', 'min:1'],
            'uoms.*.id' => ['required', 'string', 'exists:units,id'],
            'uoms.*.conversion_factor' => ['required', 'numeric'],
            'uoms.*.isCustom' => ['nullable', 'boolean'],
            ...($this->get('attributes') && count($this->get('attributes')) > 0 ?
              ['format_variant' => ['required', 'string', 'min:3', new FormatVariantValidation($this->get('attributes'))]] :
              []),
            'attributes' => ['nullable', 'array'],
            'attributes.*.attribute.id' => ['required', 'string', 'exists:attributes,id'],
            'attributes.*.attribute.name' => [
                'required',
                'string',
                'min:3',
                'max:255',
            ],
            'attributes.*.values' => ['required', 'array', 'min:1'],
            'barcodes' => ['nullable', 'array'],
            'barcodes.*.barcode' => ['required', 'string', 'min:3', 'max:255'],
            'barcodes.*.unit.id' => ['required', 'string', 'exists:units,id'],
        ];
    }
}
