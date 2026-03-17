<?php

namespace App\Http\Requests\Sales;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InternalOrderRequest extends FormRequest {
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
        $rules = [
            'date'               => ['required', 'date'],
            'referenceable_type' => ['required', 'string'],
            'referenceable_id'   => ['required', 'integer'],
            'items'              => ['required', 'array', 'min:1'],
            'items.*.id'         => ['required', 'string'],
            'items.*.item.id'    => ['required', 'exists:item_variants,id', 'distinct'],
            'items.*.quantity'   => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'    => ['required', 'exists:units,id'],
            'external_note'      => ['nullable', 'string'],
        ];

        // CONDITIONAL BUSINESS RULE
        if ($this->referenceable_type === 'App\\Models\\Sales\\SalesOrder') {
            $rules['customer.id']        = ['required', 'exists:customers,id'];
            $rules['customer_branch.id'] = ['required', 'exists:customer_branches,id'];
        }

        if ($this->referenceable_type === 'App\\Models\\Sales\\InternalOrder') {
            // customer MUST NOT exist
            $rules['customer'] = ['prohibited'];
        }

        return $rules;
    }
}
