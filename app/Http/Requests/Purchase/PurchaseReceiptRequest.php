<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;

class PurchaseReceiptRequest extends BaseFormRequest {
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
            'return_against.id'              => ['nullable', new ExistsExcludingTrashed('purchase_receipts')],
            'date'                           => ['required', 'date'],
            'purchase_order.id'              => ['required', new ExistsExcludingTrashed('purchase_orders')],
            'supplier.id'                    => ['required', new ExistsExcludingTrashed('suppliers')],
            'external_note'                  => ['nullable', 'string'],
            'items'                          => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.return_against_item_id' => ['nullable', new ExistsExcludingTrashed('purchase_receipt_items')],
            'items.*.purchase_order_item_id' => ['required', new ExistsExcludingTrashed('purchase_order_items')],
            'items.*.quantity'               => ['required', 'numeric', 'min:0'],
            'items.*.unit.id'                => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.target_warehouse.id'    => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'items.*.description'            => ['nullable', 'string'],
        ];
    }
}
