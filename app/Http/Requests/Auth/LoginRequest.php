<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class LoginRequest extends BaseFormRequest {
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
            'usernameOrEmail' => ['required', 'string'],
            'password'        => ['required', 'string'],
            'remember'        => ['nullable', 'boolean'],
            'preferred_role'  => ['nullable', 'string'],
        ];
    }
}
