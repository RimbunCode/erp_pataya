<?php

namespace App\Http\Requests\Core;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BranchRequest extends FormRequest {
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
            'code'                  => ['required', 'string', 'max:255'],
            'name'                  => ['required', 'string', 'max:255'],
            'branchable_type'       => ['nullable', 'string', 'max:255'],
            'branchable_id'         => ['nullable', 'string', 'max:255'],
            'is_disabled'           => ['nullable', 'boolean'],
            'billing_address'       => ['required', 'string', 'in:same_main,same_shipping,separate'],
            'billing_street'        => ['required_if:billing_address,separate', 'nullable', 'string', 'max:255'],
            'billing_city'          => ['required_if:billing_address,separate', 'nullable', 'string', 'max:255'],
            'billing_state'         => ['required_if:billing_address,separate', 'nullable', 'string', 'max:255'],
            'billing_zip_code'      => ['required_if:billing_address,separate', 'nullable', 'string', 'max:255'],
            'billing_country.code'  => ['required_if:billing_address,separate', 'nullable', 'string', 'exists:countries,code'],
            'shipping_street'       => ['required', 'string', 'max:255'],
            'shipping_city'         => ['required', 'string', 'max:255'],
            'shipping_state'        => ['required', 'string', 'max:255'],
            'shipping_zip_code'     => ['required', 'string', 'max:255'],
            'shipping_country.code' => ['required', 'string', 'exists:countries,code'],
        ];
    }
}
