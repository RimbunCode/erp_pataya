<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseSetting;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Core\Setting\ToleranceCalculator;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

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
     * Setiap baris item adalah salah satu dari (spec purchase-receipt-off-po-items):
     *  - normal: `purchase_order_item_id`
     *  - menggantikan PO Item X: `item.id` + `replaces_purchase_order_item_id` + `replaced_quantity`
     *  - berdiri sendiri: `item.id` saja
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'return_against.id'                       => ['nullable', new ExistsExcludingTrashed('purchase_receipts')],
            'date'                                    => ['required', 'date'],
            'purchase_order.id'                       => ['required', new ExistsExcludingTrashed('purchase_orders')],
            'supplier.id'                             => ['required', new ExistsExcludingTrashed('suppliers')],
            'external_note'                           => ['nullable', 'string'],
            'items'                                   => ['required', 'array', 'min:1'],
            'items.*.id'                              => ['required', 'string'],
            'items.*.return_against_item_id'          => ['nullable', new ExistsExcludingTrashed('purchase_receipt_items')],
            'items.*.purchase_order_item_id'          => ['nullable', 'required_without:items.*.item.id', new ExistsExcludingTrashed('purchase_order_items')],
            'items.*.item.id'                         => ['nullable', 'required_without:items.*.purchase_order_item_id', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'                          => ['nullable'],
            'items.*.replaces_purchase_order_item_id' => ['nullable', new ExistsExcludingTrashed('purchase_order_items')],
            'items.*.replaced_quantity'               => ['nullable', 'numeric', 'gt:0'],
            'items.*.quantity'                        => ['required', 'numeric', 'min:0'],
            'items.*.unit.id'                         => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                          => ['nullable'],
            'items.*.target_warehouse.id'             => ['nullable', 'required_without:items.*.purchase_order_item_id', new ExistsExcludingTrashed('warehouses')],
            'items.*.description'                     => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            // Retur memakai baris receipt asal (return_against_item_id): aturan
            // substitusi/sisa PO Item hanya untuk receipt biasa.
            if ($this->input('return_against.id')) {
                return;
            }

            $this->validateOffPoRows($validator);
        });
    }

    /**
     * Aturan lintas-baris baris di luar PO: substitusi hanya bersama `item.id`,
     * X milik PO yang sama, Y bukan item PO, dan jumlah `replaced_quantity` per X
     * tidak melebihi sisa X. Dicek ulang di bawah lock saat approve
     * (PurchaseReceiptService::onApproved).
     */
    private function validateOffPoRows(Validator $validator): void {
        $purchaseOrderId = $this->input('purchase_order.id');
        $items           = (array) $this->input('items', []);

        $replacedIds = collect($items)->pluck('replaces_purchase_order_item_id')->filter()->unique()->all();
        $replaced    = PurchaseOrderItem::whereIn('id', $replacedIds)->get()->keyBy('id');
        $poItemIds   = PurchaseOrderItem::where('purchase_order_id', $purchaseOrderId)->pluck('item_id')->all();
        $tolerance   = PurchaseSetting::current()->over_receipt_tolerance_percent;
        $calculator  = app(ToleranceCalculator::class);

        $replacedSum = [];
        foreach ($items as $index => $item) {
            $replacesId = $item['replaces_purchase_order_item_id'] ?? null;
            $itemId     = data_get($item, 'item.id');
            $poItemId   = $item['purchase_order_item_id'] ?? null;

            if ($itemId && ! $poItemId && \in_array($itemId, $poItemIds, true)) {
                $validator->errors()->add("items.{$index}.item.id", __('purchase/purchaseReceipt.validation.item_already_in_po'));
            }

            if (! $replacesId) {
                continue;
            }

            if ($poItemId || ! $itemId) {
                $validator->errors()->add("items.{$index}.replaces_purchase_order_item_id", __('purchase/purchaseReceipt.validation.replaces_requires_item'));

                continue;
            }
            if (empty($item['replaced_quantity'])) {
                $validator->errors()->add("items.{$index}.replaced_quantity", __('purchase/purchaseReceipt.validation.replaced_quantity_required'));

                continue;
            }
            if (($replaced[$replacesId]->purchase_order_id ?? null) !== $purchaseOrderId) {
                $validator->errors()->add("items.{$index}.replaces_purchase_order_item_id", __('purchase/purchaseReceipt.validation.replaces_other_po'));

                continue;
            }

            $replacedSum[$replacesId] = ($replacedSum[$replacesId] ?? 0) + (float) $item['replaced_quantity'];
            $remaining                = $calculator->allowed(
                (float) $replaced[$replacesId]->quantity,
                (float) $replaced[$replacesId]->received_quantity,
                $tolerance,
            ) ?? ((float) $replaced[$replacesId]->quantity - (float) $replaced[$replacesId]->received_quantity);
            if ($replacedSum[$replacesId] - $remaining > 0.0001) {
                $validator->errors()->add("items.{$index}.replaced_quantity", __('purchase/purchaseReceipt.validation.replaced_exceeds_remaining', [
                    'quantity'  => $replacedSum[$replacesId],
                    'remaining' => $remaining,
                ]));
            }
        }

        if ($tolerance === null) {
            return;
        }

        $requestedByPoItem = [];
        $requestedIndexes  = [];
        foreach ($items as $index => $item) {
            $poItemId = $item['purchase_order_item_id'] ?? null;
            if (! $poItemId) {
                continue;
            }

            $requestedByPoItem[$poItemId]  = ($requestedByPoItem[$poItemId] ?? 0) + (float) ($item['quantity'] ?? 0);
            $requestedIndexes[$poItemId][] = $index;
        }

        if ($requestedByPoItem === []) {
            return;
        }

        $sourceItems = PurchaseOrderItem::whereIn('id', array_keys($requestedByPoItem))->get()->keyBy('id');
        foreach ($requestedByPoItem as $sourceId => $requested) {
            $source = $sourceItems->get($sourceId);
            if (! $source || ! $calculator->exceeds($requested, (float) $source->quantity, (float) $source->received_quantity, $tolerance)) {
                continue;
            }

            $index = $requestedIndexes[$sourceId][0];
            $validator->errors()->add("items.{$index}.quantity", __('purchase/purchaseReceipt.validation.over_receipt_tolerance_exceeded', [
                'remaining' => max(0, (float) $source->quantity - (float) $source->received_quantity),
                'limit'     => $calculator->allowed((float) $source->quantity, (float) $source->received_quantity, $tolerance),
            ]));
        }
    }
}
