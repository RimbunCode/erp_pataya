<?php

namespace App\Http\Requests\CRM;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class OpportunityRequest extends FormRequest {
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
            'title'               => ['required', 'string', 'min:3', 'max:255'],
            'lead.id'             => ['nullable', 'string', 'exists:leads,id'],
            'customer.id'         => ['nullable', 'string', 'exists:customers,id'],
            'stage'               => ['required', 'string', 'in:identified,qualified,negotiation,won,lost'],
            'expected_value'      => ['nullable', 'numeric', 'min:0'],
            'probability'         => ['nullable', 'integer', 'min:0', 'max:100'],
            'expected_close_date' => ['nullable', 'date'],
            'assigned_to.id'      => ['nullable', 'string', 'exists:users,id'],
            'notes'               => ['nullable', 'string'],
        ];
    }
}
