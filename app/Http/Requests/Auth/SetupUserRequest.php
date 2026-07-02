<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class SetupUserRequest extends BaseFormRequest {
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
        $hasPassword = $this->user()->password != null;

        return [
            'name'             => ['required', 'string', 'min:3', 'max:255'],
            'email'            => ['required', 'string', 'email:rfc'],
            'username'         => ['required', 'string', 'min:3', 'max:30', 'regex:/^[\w\-\.]*$/', Rule::unique('users', 'username')->ignore($this->user()->id)->whereNull('deleted_at')],
            'gender'           => ['nullable', 'string', 'in:male,female'],
            'wants_instructor' => ['nullable', 'boolean'],
            'current_password' => ['nullable', 'current_password'],
            'password'         => ['nullable', Rule::requiredIf($this->current_password || ! $hasPassword), 'confirmed', Password::min(8)],
        ];
    }
}
