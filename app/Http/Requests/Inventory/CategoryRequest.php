<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;

class CategoryRequest extends BaseFormRequest {
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
            'name'            => ['required', 'string', 'min:3', 'max:255'],
            'type'            => ['required', 'string', 'min:3', 'max:255'],
            'default_unit.id' => ['nullable', 'string', new ExistsExcludingTrashed('units')],
        ];
    }
}
