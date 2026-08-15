<?php

namespace App\Http\Requests\Service;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class WorkOrderRequest extends BaseFormRequest {
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
        // $customerValidation = $this->for_internal ?? false ? 'nullable' :
        // dd($this->route()->parameters());
        if (($this->route()->parameters()['level'] ?? 0) > 0) {
            return [];
        }

        return [
            'date'                => ['required', 'date'],
            'for_internal'        => ['nullable', 'boolean'],
            'customer.id'         => [Rule::requiredIf(! $this->for_internal ?? false), new ExistsExcludingTrashed('customers')],
            'customer.*'          => ['nullable'],
            'customer_branch.id'  => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'   => ['nullable'],
            'item_service.id'     => ['required', new ExistsExcludingTrashed('item_variants')],
            'item_service.*'      => ['nullable'],
            'items'               => ['required', 'array', 'min:1'],
            'items.*.id'          => ['required', 'string'],
            'items.*.item.id'     => ['required', new ExistsExcludingTrashed('item_variants'), 'distinct'],
            'items.*.item.*'      => ['nullable'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity'    => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'     => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'      => ['nullable'],
            'external_note'       => ['nullable', 'string'],
        ];
    }
}
