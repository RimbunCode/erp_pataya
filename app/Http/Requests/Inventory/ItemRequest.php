<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use App\Rules\FormatVariantValidation;
use Illuminate\Validation\Rule;

class ItemRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'code' => [
                'required',
                'string',
                'min:3',
                'max:255',
                'regex:/^[\w\-\.]*$/',
                Rule::unique('items')->whereNull('deleted_at')->ignore($this->id),
            ],
            'name'                          => ['required', 'string', 'min:3', 'max:255'],
            'description'                   => ['nullable', 'string'],
            'category.id'                   => ['required', 'string', new ExistsExcludingTrashed('categories')],
            'default_unit.id'               => ['required', 'string', new ExistsExcludingTrashed('units')],
            'is_disabled'                   => ['nullable', 'boolean'],
            'allow_alternative_item'        => ['nullable', 'boolean'],
            'is_fixed_asset'                => ['nullable', 'boolean'],
            'uoms'                          => ['required', 'array', 'min:1'],
            'uoms.*.id'                     => ['required', 'string', new ExistsExcludingTrashed('units')],
            'uoms.*.conversion_factor'      => ['nullable', 'numeric'],
            'uoms.*.isCustom'               => ['nullable', 'boolean'],
            'uoms.*.readOnly'               => ['nullable', 'boolean'],
            'uoms.*.isManual'               => ['nullable', 'boolean'],
            'uoms.*.generatedByDefaultUnit' => ['nullable', 'boolean'],
            ...($this->input('attributes') && \count($this->input('attributes')) > 0 ?
                ['format_variant' => ['required', 'string', 'min:3', new FormatVariantValidation($this->get('attributes'))]] :
                []),
            'attributes'                  => ['nullable', 'array'],
            'attributes.*.attribute.id'   => ['required', 'string', new ExistsExcludingTrashed('attributes')],
            'attributes.*.attribute.name' => [
                'required',
                'string',
                'min:3',
                'max:255',
            ],
            'attributes.*.values'      => ['required', 'array', 'min:1'],
            'barcodes'                 => ['nullable', 'array'],
            'barcodes.*.barcode'       => ['required', 'string', 'min:3', 'max:255'],
            'barcodes.*.basic_unit.id' => ['required', 'string', new ExistsExcludingTrashed('units')],
            'image'                    => ['nullable', 'array'],
            'image.*.id'               => ['required', 'string', new ExistsExcludingTrashed('files')],
        ];
    }
}
