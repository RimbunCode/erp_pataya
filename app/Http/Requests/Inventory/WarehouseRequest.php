<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class WarehouseRequest extends BaseFormRequest {
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
            'branch.id' => ['nullable', 'string', 'exists:branches,id'],
            'code'      => ['required', 'string', 'min:2', 'max:20', 'regex:/^[\w\-\.\\\\\/]*$/', Rule::unique('warehouses')->whereNull('deleted_at')->ignore($this->id)],
            'name'      => ['required', 'string', 'min:3', 'max:255'],
            'pic.id'    => ['nullable', 'string', 'exists:users,id'],
        ];
    }
}
