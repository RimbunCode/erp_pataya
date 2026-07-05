<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
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
            'return_against.id'              => ['nullable', 'exists:purchase_receipts,id'],
            'date'                           => ['required', 'date'],
            'purchase_order.id'              => ['required', 'exists:purchase_orders,id'],
            'supplier.id'                    => ['required', 'exists:suppliers,id'],
            'external_note'                  => ['nullable', 'string'],
            'items'                          => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.return_against_item_id' => ['nullable', 'exists:purchase_receipt_items,id'],
            'items.*.purchase_order_item_id' => ['required', 'exists:purchase_order_items,id'],
            'items.*.quantity'               => ['required', 'numeric', 'min:0'],
            'items.*.unit.id'                => ['required', 'exists:item_units,id'],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.target_warehouse.id'    => ['nullable', 'exists:warehouses,id'],
            'items.*.description'            => ['nullable', 'string'],
        ];
    }
}
