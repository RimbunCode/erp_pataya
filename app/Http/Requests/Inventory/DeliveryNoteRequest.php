<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Models\Asset\Asset;
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
            'items.*.asset_lines'            => ['nullable', 'array'],
            'items.*.asset_lines.*.asset.id' => ['required', 'string', new ExistsExcludingTrashed('assets')],
            'items.*.asset_lines.*.quantity' => ['required', 'numeric', 'gt:0'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateAssetServiceConsumedItemQuantity($validator);
            $this->validateAssetLines($validator);
        });
    }

    /**
     * Requirement 1.2, 1.3, spec asset-rental-migration: sum(asset_lines.quantity)
     * harus sama dengan item.quantity, Asset harus is_rentable, dan Asset.item_id
     * harus cocok dengan Item baris induk — divalidasi SEBELUM submit (bukan
     * baru saat approve seperti sebelumnya), supaya user langsung tahu baris
     * mana yang salah alih-alih ditolak belakangan oleh approver lain.
     * Availability quantity (rental_quantity/sold_quantity) SENGAJA TIDAK
     * divalidasi di sini — itu tetap dicek saat approve (Requirement 5.4: tidak
     * ada reservasi/booking Asset di level dokumen, availability real-time
     * cuma valid diperiksa saat transaksi benar-benar terjadi).
     */
    private function validateAssetLines(Validator $validator): void {
        foreach ((array) $this->input('items', []) as $index => $item) {
            $lines = $item['asset_lines'] ?? [];
            if ($lines === []) {
                continue;
            }

            $referenceableId   = $item['referenceable_id'] ?? null;
            $referenceableType = $item['referenceable_type'] ?? null;
            $itemModelId       = $this->resolveItemId($referenceableType, $referenceableId);

            $sum = array_sum(array_map(fn ($line) => (float) ($line['quantity'] ?? 0), $lines));
            if (abs($sum - (float) ($item['quantity'] ?? 0)) > 0.0001) {
                $validator->errors()->add("items.{$index}.asset_lines", __('asset/asset.quantity_mismatch'));

                continue;
            }

            foreach ($lines as $lineIndex => $line) {
                $asset = Asset::with('assetCategory')->find(data_get($line, 'asset.id'));
                if (! $asset) {
                    $validator->errors()->add("items.{$index}.asset_lines.{$lineIndex}.asset", __('validation.exists'));

                    continue;
                }
                if (! $asset->is_rentable) {
                    $validator->errors()->add("items.{$index}.asset_lines.{$lineIndex}.asset", __('asset/asset.asset_not_rentable'));
                }
                if ($itemModelId && $asset->item_id !== $itemModelId) {
                    $validator->errors()->add("items.{$index}.asset_lines.{$lineIndex}.asset", __('asset/asset.item_mismatch'));
                }
            }
        }
    }

    private function resolveItemId(?string $referenceableType, ?string $referenceableId): ?string {
        if (! $referenceableId) {
            return null;
        }

        $referenceable = match ($referenceableType) {
            SalesOrderItem::class    => SalesOrderItem::find($referenceableId),
            InternalOrderItem::class => InternalOrderItem::find($referenceableId),
            default                  => null,
        };

        return $referenceable?->item?->item_id;
    }

    /**
     * Requirement 8.1, spec asset-service-billing; Requirement 3.4, spec
     * asset-service-internal-order: baris DeliveryNoteItem yang SalesOrderItem
     * ATAU InternalOrderItem asalnya referenceable ke AssetServiceConsumedItem
     * tidak boleh mengambil quantity melebihi part yang sebenarnya dipakai.
     */
    private function validateAssetServiceConsumedItemQuantity(Validator $validator): void {
        foreach ((array) $this->input('items', []) as $index => $item) {
            $referenceableType = $item['referenceable_type'] ?? null;
            if (! in_array($referenceableType, [SalesOrderItem::class, InternalOrderItem::class], true)) {
                continue;
            }

            $sourceItem = $referenceableType === SalesOrderItem::class
                ? SalesOrderItem::find($item['referenceable_id'] ?? null)
                : InternalOrderItem::find($item['referenceable_id'] ?? null);
            if (! $sourceItem || $sourceItem->referenceable_type !== AssetServiceConsumedItem::class) {
                continue;
            }

            $consumedItem = $sourceItem->referenceable;
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
