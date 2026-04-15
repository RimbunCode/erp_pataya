<?php

namespace App\Http\Requests\User;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class UserRequest extends BaseFormRequest {
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
            'name'              => ['required', 'string', 'min:3', 'max:255'],
            'email'             => ['required', 'string', 'email:rfc'],
            'username'          => ['nullable', Rule::requiredIf(fn () => $this->id == $this->user()->id), 'string', 'regex:/^[\w\-\.]*$/'],
            'gender'            => ['nullable', 'string', 'in:male,female'],
            'birthdate'         => ['nullable', 'date'],
            'phone'             => ['nullable', 'string'],
            'roles'             => ['nullable', 'array', 'min:1'],
            'roles.*'           => ['required', 'string', 'exists:roles,id'],
            'branches'          => ['nullable', 'array', 'min:1'],
            'branches.*'        => ['nullable', Rule::requiredIf(fn () => $this->id != $this->user()->id), 'string', 'exists:branches,id'],
            'default_branch_id' => ['nullable', Rule::requiredIf(fn () => $this->id != $this->user()->id), 'string', 'exists:branches,id'],
        ];
    }
}
