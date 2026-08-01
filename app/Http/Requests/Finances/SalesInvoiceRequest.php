<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;

class SalesInvoiceRequest extends BaseFormRequest {
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
            'sales_order.id'                 => ['nullable', new ExistsExcludingTrashed('sales_orders')],
            'sales_order.*'                  => ['nullable'],
            'return_against.id'              => ['nullable', new ExistsExcludingTrashed('sales_invoices')],
            'income_account.id'              => ['required', new ExistsExcludingTrashed('accounts')],
            'debit_account.id'               => ['required', new ExistsExcludingTrashed('accounts')],
            'customer.id'                    => ['required', new ExistsExcludingTrashed('customers')],
            'customer.*'                     => ['nullable'],
            'customer_branch.id'             => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'              => ['nullable'],
            'items'                          => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.sales_order_item.id'    => ['required', new ExistsExcludingTrashed('sales_order_items')],
            'items.*.sales_order_item.*'     => ['nullable'],
            'items.*.description'            => ['nullable', 'string'],
            'items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.tax.id'                 => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'                  => ['nullable'],
            'items.*.price'                  => ['nullable', 'numeric'],
            'items.*.return_against_item_id' => ['nullable', new ExistsExcludingTrashed('sales_invoice_items')],
            'currency.code'                  => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                  => ['nullable', 'numeric'],
            'external_note'                  => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),

        ];
    }
}
