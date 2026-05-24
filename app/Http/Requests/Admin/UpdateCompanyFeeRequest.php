<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class UpdateCompanyFeeRequest extends BaseFormRequest {
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
            'company_fee_percentage' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
        ];
    }
}
