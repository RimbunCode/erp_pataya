<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;

class SupplierRequest extends BaseFormRequest {
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
            'branch_of.id'    => ['nullable', 'string', new ExistsExcludingTrashed('suppliers')],
            'name'            => ['required', 'string', 'min:3', 'max:255'],
            'phone'           => ['required', 'string', 'min:3', 'max:255'],
            'email'           => ['required', 'string', 'min:3', 'max:255', 'email:rfc'],
            'banks'           => ['required', 'array', 'min:1'],
            'banks.*.bank'    => ['required', 'string', 'min:3'],
            'banks.*.no_acc'  => ['required', 'numeric', 'min:5'],
            'banks.*.account' => ['required', 'string', 'min:3'],
            'street'          => ['required', 'string', 'min:3', 'max:255'],
            'city'            => ['required', 'string', 'min:3', 'max:255'],
            'province'        => ['required', 'string', 'min:3', 'max:255'],
            'zip_code'        => ['required', 'string', 'min:3', 'max:255'],
            'country.code'    => ['required', 'string', 'exists:countries,code'],
            'is_disabled'     => ['nullable', 'boolean'],
        ];
    }
}
