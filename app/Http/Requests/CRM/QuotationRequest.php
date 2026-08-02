<?php

namespace App\Http\Requests\CRM;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class QuotationRequest extends FormRequest {
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
            'date'                => ['required', 'date'],
            'valid_until'         => ['nullable', 'date', 'after_or_equal:date'],
            'customer.id'         => ['required', 'string', 'exists:customers,id'],
            'opportunity.id'      => ['nullable', 'string', 'exists:opportunities,id'],
            'items'               => ['required', 'array', 'min:1'],
            'items.*.id'          => ['required', 'string'],
            'items.*.item.id'     => ['required', 'string', 'exists:item_variants,id'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity'    => ['required', 'numeric', 'min:0.01'],
            'items.*.price'       => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
