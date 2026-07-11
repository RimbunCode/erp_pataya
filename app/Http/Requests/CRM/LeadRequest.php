<?php

namespace App\Http\Requests\CRM;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class LeadRequest extends FormRequest {
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
            'company_name'     => ['required', 'string', 'min:3', 'max:255'],
            'contact_name'     => ['nullable', 'string', 'max:255'],
            'email'            => ['nullable', 'string', 'max:255', 'email:rfc'],
            'phone'            => ['nullable', 'string', 'max:255'],
            'lead_source.code' => ['nullable', 'string', 'exists:lead_sources,code'],
            'status'           => ['required', 'string', 'in:new,contacted,qualified,unqualified,converted'],
            'notes'            => ['nullable', 'string'],
            'assigned_to.id'   => ['nullable', 'string', 'exists:users,id'],
            'street'           => ['nullable', 'string', 'max:255'],
            'city'             => ['nullable', 'string', 'max:255'],
            'province'         => ['nullable', 'string', 'max:255'],
            'zip_code'         => ['nullable', 'string', 'max:255'],
            'country.code'     => ['nullable', 'string', 'exists:countries,code'],
        ];
    }
}
