<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Http\Requests\Finances\Rules\ReturnAgainstItemRules;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

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
            'date'                             => ['required', 'date'],
            'purchase_order.id'                => ['nullable', new ExistsExcludingTrashed('purchase_orders')],
            'purchase_order.*'                 => ['nullable'],
            'return_against.id'                => ['nullable', new ExistsExcludingTrashed('purchase_invoices')],
            'expense_head_account.id'          => ['required', new ExistsExcludingTrashed('accounts')],
            'credit_account.id'                => ['required', new ExistsExcludingTrashed('accounts')],
            'items'                            => ['required', 'array', 'min:1'],
            'items.*.id'                       => ['required', 'string'],
            'items.*.purchase_order_item.id'   => ['nullable', 'required_without_all:items.*.purchase_receipt_item.id,items.*.item.id', new ExistsExcludingTrashed('purchase_order_items')],
            'items.*.purchase_order_item.*'    => ['nullable'],
            'items.*.purchase_receipt_item.id' => ['nullable', new ExistsExcludingTrashed('purchase_receipt_items')],
            'items.*.purchase_receipt_item.*'  => ['nullable'],
            'items.*.item.id'                  => ['nullable', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'                   => ['nullable'],
            'items.*.description'              => ['nullable', 'string'],
            'items.*.referenceable_type'       => ['nullable', 'string'],
            'items.*.referenceable_id'         => ['nullable', 'string'],
            'items.*.quantity'                 => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                  => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                   => ['nullable'],
            'items.*.tax.id'                   => ['nullable', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'                    => ['nullable'],
            'items.*.rate'                     => ['required', 'numeric', 'min:0'],
            'items.*.return_against_item_id'   => ['nullable', new ExistsExcludingTrashed('purchase_invoice_items')],
            'supplier.id'                      => ['required', new ExistsExcludingTrashed('suppliers')],
            'supplier.*'                       => ['nullable'],
            'currency.code'                    => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                    => ['nullable', 'numeric'],
            'external_note'                    => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            // Retur memakai baris invoice asal (return_against_item_id): aturan
            // baris di luar PO hanya untuk invoice biasa.
            if (! $this->input('return_against.id')) {
                $this->validateOffPoRows($validator);
            }
            ReturnAgainstItemRules::validate($validator, (array) $this->input('items', []), $this->input('return_against.id'), 'purchase_invoice_items', 'purchase_invoice_id', 'purchase_invoices', [
                'purchase_order_item.id'   => 'purchase_order_item_id',
                'purchase_receipt_item.id' => 'purchase_receipt_item_id',
                'item.id'                  => 'item_id',
                'unit.id'                  => 'item_unit_id',
            ]);
        });
    }

    /**
     * Baris receipt: milik receipt PO ini, sudah di-approve, bertipe berdiri
     * sendiri. Item bebas: bukan item PO mana pun pada PO ini (anti-bypass
     * dedupe dropdown). Keduanya butuh `purchase_order.id`.
     */
    private function validateOffPoRows(Validator $validator): void {
        $purchaseOrderId = $this->input('purchase_order.id');
        $items           = (array) $this->input('items', []);

        $poItemIds = $purchaseOrderId
            ? PurchaseOrderItem::where('purchase_order_id', $purchaseOrderId)->pluck('item_id')->all()
            : [];

        foreach ($items as $index => $item) {
            // Prioritas sumber (sama dgn PurchaseInvoiceService): PO Item > baris receipt > item.
            // Baris ber-PO Item (termasuk baris retur yang membawa `item` dari relasi) dilewati.
            if (data_get($item, 'purchase_order_item.id')) {
                continue;
            }
            $receiptItemId = data_get($item, 'purchase_receipt_item.id');
            $itemId        = $receiptItemId ? null : data_get($item, 'item.id');
            if (! $receiptItemId && ! $itemId) {
                continue;
            }

            if (! $purchaseOrderId) {
                $validator->errors()->add("items.{$index}.purchase_order_item.id", __('finances/purchaseInvoice.validation.purchase_order_required'));

                continue;
            }

            if ($itemId && \in_array($itemId, $poItemIds, true)) {
                $validator->errors()->add("items.{$index}.item.id", __('finances/purchaseInvoice.validation.item_already_in_po'));
            }

            if ($receiptItemId && ! $this->isBillableReceiptItem($receiptItemId, $purchaseOrderId)) {
                $validator->errors()->add("items.{$index}.purchase_receipt_item.id", __('finances/purchaseInvoice.validation.receipt_item_not_billable'));
            }
        }
    }

    private function isBillableReceiptItem(string $receiptItemId, string $purchaseOrderId): bool {
        $row = PurchaseReceiptItem::find($receiptItemId);
        if (! $row || $row->purchase_order_item_id || $row->replaces_purchase_order_item_id) {
            return false;
        }

        return PurchaseReceipt::whereKey($row->purchase_receipt_id)
            ->where('purchase_order_id', $purchaseOrderId)
            ->whereNotNull('submitted_at')
            ->whereJsonContains('status', 'received')
            ->exists();
    }
}
