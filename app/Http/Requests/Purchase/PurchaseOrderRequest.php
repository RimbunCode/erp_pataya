<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Models\Core\Preference;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PurchaseOrderRequest extends FormRequest {
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
        $default_currency = Preference::find('default_currency_id')?->value;

        return [
            'date'                        => ['required', 'date'],
            'required_date'               => ['required', 'date', Rule::date()->afterOrEqual($this->date)],
            'external_note'               => ['nullable', 'string'],
            'supplier.id'                 => ['required', 'exists:suppliers,id'],
            'supplier.*'                  => ['nullable'],
            'exchange_rate'               => ['nullable', Rule::requiredIf($this->currency && $this->currency['code'] != $default_currency), 'numeric'],
            'currency.code'               => ['nullable', 'exists:currencies,code'],
            'currency.*'                  => ['nullable'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.id'                  => ['required', 'string'],
            'items.*.item.id'             => ['required', 'exists:item_variants,id'],
            'items.*.item.*'              => ['nullable'],
            'items.*.description'         => ['nullable', 'string'],
            'items.*.referenceable_type'  => ['nullable', 'string'],
            'items.*.referenceable_id'    => ['nullable', 'string'],
            'items.*.required_date'       => ['required', 'date', Rule::date()->afterOrEqual($this->date)],
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', 'exists:units,id'],
            'items.*.unit.*'              => ['nullable'],
            'items.*.target_warehouse.id' => ['required', 'exists:warehouses,id'],
            'items.*.target_warehouse.*'  => ['nullable'],
            'items.*.tax.id'              => ['nullable', 'exists:taxes,id'],
            'items.*.tax.*'               => ['nullable'],
            'items.*.rate'                => ['required', 'numeric', 'min:0'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }
}
