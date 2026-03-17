<?php

namespace App\Http\Requests\Sales;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CustomerRequest extends FormRequest {
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
            'name'                             => ['required', 'string', 'min:3', 'max:255'],
            'phone'                            => ['required', 'string', 'min:3', 'max:255'],
            'email'                            => ['required', 'string', 'min:3', 'max:255', 'email:rfc'],
            'vat'                              => ['required', 'string', 'min:3', 'max:255'],
            'street'                           => ['required', 'string', 'min:3', 'max:255'],
            'city'                             => ['required', 'string', 'min:3', 'max:255'],
            'province'                         => ['required', 'string', 'min:3', 'max:255'],
            'zip_code'                         => ['required', 'string', 'min:3', 'max:255'],
            'country.code'                     => ['required', 'string', 'exists:countries,code'],
            'is_disabled'                      => ['nullable', 'boolean'],
            'branches'                         => ['nullable', 'array'],
            'branches.*.id'                    => ['nullable', 'string'],
            'branches.*.code'                  => ['required', 'string', 'max:255'],
            'branches.*.name'                  => ['required', 'string', 'max:255'],
            'branches.*.is_disabled'           => ['nullable', 'boolean'],
            'branches.*.billing_address'       => ['required', 'string', 'in:same_main,same_shipping,separate'],
            'branches.*.billing_street'        => ['required_if:branches.*.billing_address,separate', 'nullable', 'string', 'max:255'],
            'branches.*.billing_city'          => ['required_if:branches.*.billing_address,separate', 'nullable', 'string', 'max:255'],
            'branches.*.billing_state'         => ['required_if:branches.*.billing_address,separate', 'nullable', 'string', 'max:255'],
            'branches.*.billing_zip_code'      => ['required_if:branches.*.billing_address,separate', 'nullable', 'string', 'max:255'],
            'branches.*.billing_country.code'  => ['required_if:branches.*.billing_address,separate', 'nullable', 'string', 'exists:countries,code'],
            'branches.*.shipping_street'       => ['required', 'string', 'max:255'],
            'branches.*.shipping_city'         => ['required', 'string', 'max:255'],
            'branches.*.shipping_state'        => ['required', 'string', 'max:255'],
            'branches.*.shipping_zip_code'     => ['required', 'string', 'max:255'],
            'branches.*.shipping_country.code' => ['required', 'string', 'exists:countries,code'],
        ];
    }
}
