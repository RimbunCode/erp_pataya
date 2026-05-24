<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class MarkPayoutPaidRequest extends BaseFormRequest {
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
            'transfer_reference' => ['required', 'string', 'max:255'],
            'proof_file'         => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:4096'],
        ];
    }
}
