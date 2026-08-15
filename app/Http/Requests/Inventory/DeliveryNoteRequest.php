<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class DeliveryNoteRequest extends BaseFormRequest {
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
            'return_against.id'              => ['nullable', new ExistsExcludingTrashed('delivery_notes')],
            'customer.id'                    => [Rule::requiredIf($this->reference_to['model'] === 'App\\Models\\Sales\\SalesOrder'), new ExistsExcludingTrashed('customers')],
            'customer_branch.id'             => ['required', new ExistsExcludingTrashed('branches')],
            'reference_to.id'                => ['required', 'string', new ExistsExcludingTrashed('permissions')],
            'reference_to.*'                 => ['nullable'],
            'referenceable_id'               => ['required', 'string'],
            'referenceable_type'             => ['required', Rule::in([SalesOrder::class, InternalOrder::class])],
            'delivery_date'                  => ['required', 'date'],
            'items.*'                        => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.source_warehouse.id'    => ['required', new ExistsExcludingTrashed('warehouses')],
            'items.*.referenceable_id'       => ['required', 'string'],
            'items.*.referenceable_type'     => ['required', Rule::in([SalesOrderItem::class, InternalOrderItem::class])],
            'items.*.description'            => ['nullable', 'string'],
            'items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.return_against_item.id' => ['nullable', new ExistsExcludingTrashed('delivery_note_items')],
        ];
    }
}
