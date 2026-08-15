<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Rules\ExistsExcludingTrashed;
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
            'purchase_order.id'              => ['nullable', new ExistsExcludingTrashed('purchase_orders')],
            'purchase_order.*'               => ['nullable'],
            'return_against.id'              => ['nullable', new ExistsExcludingTrashed('purchase_invoices')],
            'expense_head_account.id'        => ['required', new ExistsExcludingTrashed('accounts')],
            'credit_account.id'              => ['required', new ExistsExcludingTrashed('accounts')],
            'items'                          => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.purchase_order_item.id' => ['required', new ExistsExcludingTrashed('purchase_order_items')],
            'items.*.purchase_order_item.*'  => ['nullable'],
            'items.*.description'            => ['nullable', 'string'],
            'items.*.referenceable_type'     => ['nullable', 'string'],
            'items.*.referenceable_id'       => ['nullable', 'string'],
            'items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.tax.id'                 => ['nullable', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'                  => ['nullable'],
            'items.*.rate'                   => ['required', 'numeric', 'min:0'],
            'items.*.return_against_item_id' => ['nullable', new ExistsExcludingTrashed('purchase_invoice_items')],
            'supplier.id'                    => ['required', new ExistsExcludingTrashed('suppliers')],
            'supplier.*'                     => ['nullable'],
            'currency.code'                  => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                  => ['nullable', 'numeric'],
            'external_note'                  => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }
}
