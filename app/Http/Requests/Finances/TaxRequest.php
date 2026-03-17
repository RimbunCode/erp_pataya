<?php

namespace App\Http\Requests\Finances;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class TaxRequest extends FormRequest {
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
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'rate' => ['required', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
