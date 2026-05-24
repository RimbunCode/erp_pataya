<?php

namespace App\Http\Requests\Instructor;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class StorePayoutRequestRequest extends BaseFormRequest {
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
            'requested_amount' => ['required', 'numeric', 'gt:0'],
            'note'             => ['nullable', 'string', 'max:1000'],
        ];
    }
}
