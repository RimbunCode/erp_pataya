<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use Illuminate\Contracts\Validation\ValidationRule;

class PurchaseInvoiceRequest extends BaseFormRequest {
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
            'date'                           => ['required', 'date'],
            'purchase_order.id'              => ['nullable', 'exists:purchase_orders,id'],
            'purchase_order.*'               => ['nullable'],
            'return_against.id'              => ['nullable', 'exists:purchase_invoices,id'],
            'expense_head_account.id'        => ['required', 'exists:accounts,id'],
            'credit_account.id'              => ['required', 'exists:accounts,id'],
            'items'                          => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.item.id'                => ['required', 'exists:item_variants,id'],
            'items.*.item.*'                 => ['nullable'],
            'items.*.description'            => ['nullable', 'string'],
            'items.*.referenceable_type'     => ['nullable', 'string'],
            'items.*.referenceable_id'       => ['nullable', 'string'],
            'items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                => ['required', 'exists:item_units,id'],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.tax.id'                 => ['nullable', 'exists:taxes,id'],
            'items.*.tax.*'                  => ['nullable'],
            'items.*.rate'                   => ['required', 'numeric', 'min:0'],
            'items.*.purchase_order_item_id' => ['nullable', 'exists:purchase_order_items,id'],
            'items.*.return_against_item_id' => ['nullable', 'exists:purchase_invoice_items,id'],
            'supplier.id'                    => ['required', 'exists:suppliers,id'],
            'supplier.*'                     => ['nullable'],
            'currency.code'                  => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                  => ['nullable', 'numeric'],
            'external_note'                  => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }
}
