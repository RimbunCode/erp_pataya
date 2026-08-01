<?php

namespace App\Http\Requests\Sales;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Validation\Rule;

class SalesOrderRequest extends BaseFormRequest {
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
            'date'           => ['required', 'date'],
            'rent_date.from' => [Rule::requiredIf($this->is_rent ?? false), 'date', 'nullable'],
            'rent_date.to'   => [
                Rule::requiredIf($this->is_rent ?? false),
                Rule::date()->afterOrEqual($this->start_date ?? now()),
                'date',
                'nullable',
            ],
            'is_rent'                     => ['nullable', 'boolean'],
            'customer.id'                 => [Rule::requiredIf(! ($this->is_rent ?? false)), new ExistsExcludingTrashed('customers')],
            'customer.*'                  => ['nullable'],
            'customer_branch.id'          => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'           => ['nullable'],
            'reference_so.id'             => ['nullable', new ExistsExcludingTrashed('sales_orders')],
            'reference_so.*'              => ['nullable'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.id'                  => ['required', 'string'],
            'items.*.item.id'             => ['required', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'              => ['nullable'],
            'items.*.description'         => ['nullable', 'string'],
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'              => ['nullable'],
            'items.*.tax.id'              => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'               => ['nullable'],
            'items.*.price'               => ['nullable', 'numeric'],
            'items.*.source_warehouse.id' => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'currency.code'               => ['nullable', 'exists:currencies,code'],
            'exchange_rate'               => ['nullable', 'numeric'],
            'external_note'               => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }
}
