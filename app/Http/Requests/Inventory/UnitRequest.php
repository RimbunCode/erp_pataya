<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UnitRequest extends FormRequest {
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
            'group' => ['required', 'string', 'min:2', 'max:255'],
            'code'  => [
                'required',
                'string',
                'min:2',
                'max:20',
                'regex:/^[\w\-\.]*$/',
                Rule::unique('units')->whereNull('deleted_at')->ignore($this->id),
            ],
            'name'              => ['required', 'string', 'min:2', 'max:255'],
            'customable'        => ['nullable', 'boolean'],
            'conversion_factor' => [
                $this->customable == true ? 'nullable' : 'required',
                'numeric',
                'min:0',
            ],
        ];
    }
}
