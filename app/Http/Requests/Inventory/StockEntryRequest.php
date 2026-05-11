<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class StockEntryRequest extends BaseFormRequest {
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
            'date'                                  => ['required', 'date'],
            'type'                                  => ['required', 'string', 'in:item_transfer,item_issue,item_consumption,item_receipt'],
            // 'in_transit' => ['nullable', 'required_if:type,item_transfer', 'boolean'],
            'in_transit'                            => ['nullable', 'boolean'],
            // 'received_date' => ['nullable', 'required_if:type,item_transfer', 'date'],
            'received_date'                         => ['nullable', 'date'],
            'notes'                                 => ['nullable', 'string'],
            'difference_account.id'                 => ['required', 'exists:accounts,id'],
            'items'                                 => ['required', 'array', 'min:1'],
            'items.*.id'                            => ['required'],
            'items.*.item.id'                       => ['required', 'exists:item_variants,id'],
            'items.*.item.*'                        => ['nullable'],
            'items.*.quantity'                      => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                       => ['required', 'exists:item_units,id'],
            'items.*.unit.*'                        => ['nullable'],
            'items.*.source_warehouse.id'           => ['nullable', 'exists:warehouses,id'],
            'items.*.source_warehouse.*'            => ['nullable'],
            'items.*.target_warehouse.id'           => ['nullable', 'exists:warehouses,id'],
            'items.*.target_warehouse.*'            => ['nullable'],
            'items.*.basic_rate'                    => ['nullable', 'required_if:type,item_receipt', 'numeric', 'min:0'],
            'items.*.conversion_factor'             => ['nullable', 'numeric', 'min:0'],
            'additional_costs'                      => ['nullable', 'array'],
            'additional_costs.*.id'                 => ['required'],
            'additional_costs.*.expense_account.id' => ['required', 'exists:accounts,id'],
            'additional_costs.*.purpose'            => ['required', 'string'],
            'additional_costs.*.amount'             => ['required', 'numeric'],
        ];
    }
}
