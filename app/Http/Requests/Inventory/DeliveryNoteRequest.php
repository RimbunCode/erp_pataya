<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
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

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateAssetServiceConsumedItemQuantity($validator);
        });
    }

    /**
     * Requirement 8.1, spec asset-service-billing: baris DeliveryNoteItem yang
     * SalesOrderItem asalnya referenceable ke AssetServiceConsumedItem tidak
     * boleh mengambil quantity melebihi part yang sebenarnya dipakai.
     */
    private function validateAssetServiceConsumedItemQuantity(Validator $validator): void {
        foreach ((array) $this->input('items', []) as $index => $item) {
            if (($item['referenceable_type'] ?? null) !== SalesOrderItem::class) {
                continue;
            }

            $salesOrderItem = SalesOrderItem::find($item['referenceable_id'] ?? null);
            if (! $salesOrderItem || $salesOrderItem->referenceable_type !== AssetServiceConsumedItem::class) {
                continue;
            }

            $consumedItem = $salesOrderItem->referenceable;
            if (! $consumedItem) {
                continue;
            }

            if ((float) ($item['quantity'] ?? 0) > (float) $consumedItem->quantity) {
                $validator->errors()->add(
                    "items.{$index}.quantity",
                    __('asset/service.consumed_item_quantity_exceeded'),
                );
            }
        }
    }
}
