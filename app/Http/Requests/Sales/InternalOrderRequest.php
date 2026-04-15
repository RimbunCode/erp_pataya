<?php

namespace App\Http\Requests\Sales;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class InternalOrderRequest extends BaseFormRequest {
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
            'date'               => ['required', 'date'],
            'referenceable_type' => ['required', 'string'],
            'referenceable_id'   => ['required', 'integer'],
            'items'              => ['required', 'array', 'min:1'],
            'items.*.id'         => ['required', 'string'],
            'items.*.item.id'    => ['required', 'exists:item_variants,id', 'distinct'],
            'items.*.quantity'   => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'    => ['required', 'exists:units,id'],
            'external_note'      => ['nullable', 'string'],
            'customer.id'        => [
                Rule::requiredIf($this->referenceable_type === 'App\\Models\\Sales\\SalesOrder'),
                'exists:customers,id',
            ],
            'customer_branch.id' => [
                Rule::requiredIf($this->referenceable_type === 'App\\Models\\Sales\\SalesOrder'),
                'exists:customer_branches,id',
            ],
            'customer' => [
                Rule::prohibitedIf($this->referenceable_type === 'App\\Models\\Sales\\InternalOrder'),
            ],
        ];
    }
}
