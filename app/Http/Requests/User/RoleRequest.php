<?php

namespace App\Http\Requests\User;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class RoleRequest extends BaseFormRequest {
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
            'name'                  => ['required', 'string', 'min:3', 'max:255'],
            'description'           => ['nullable', 'string'],
            'is_disabled'           => ['nullable', 'boolean'],
            'rules'                 => ['nullable', 'array', 'min:1'],
            'rules.*.id'            => ['required', 'string'],
            'rules.*.permission_id' => ['required', 'string', 'exists:permissions,id'],
            'rules.*.level'         => ['required', 'integer'],
            'rules.*.only_creator'  => ['required', 'boolean'],
            'rules.*.permissions'   => ['required', 'array'],
        ];
    }
}
