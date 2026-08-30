<?php

namespace App\Http\Requests\Sales;

use App\Enums\FormStatus;
use App\Http\Requests\BaseFormRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrderItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class InternalOrderRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array {
        return [
            'date'            => ['required', 'date'],
            'external_note'   => ['nullable', 'string'],
            'items'           => ['required', 'array', 'min:1'],
            'items.*.id'      => ['required', 'string'],
            'items.*.item.id' => [
                'required',
                new ExistsExcludingTrashed('item_variants'),
                // Requirement 4, spec asset-service-internal-order: distinct
                // TIDAK berlaku untuk baris referenceable — 2 AssetServiceConsumedItem
                // beda bisa saja pakai ItemVariant sama (part identik, servis beda).
                // Dicek manual di sini (bukan rule string 'distinct' polos) karena
                // butuh exception per-baris, bukan blanket rule.
                function (string $attribute, mixed $value, \Closure $fail): void {
                    preg_match('/^items\.(\d+)\.item\.id$/', $attribute, $matches);
                    $index = $matches[1] ?? null;
                    if ($index === null) {
                        return;
                    }

                    $referenceableType = $this->input("items.{$index}.referenceable.type");
                    if ($referenceableType) {
                        return;
                    }

                    $items = (array) $this->input('items', []);
                    foreach ($items as $otherIndex => $other) {
                        if ((string) $otherIndex === (string) $index) {
                            continue;
                        }
                        if (! empty($other['referenceable']['type'] ?? null)) {
                            continue;
                        }
                        if (($other['item']['id'] ?? null) === $value) {
                            $fail(__('validation.distinct'));

                            return;
                        }
                    }
                },
            ],
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'              => ['nullable'],
            'items.*.source_warehouse.id' => ['nullable', 'exists:warehouses,id'],
            'items.*.source_warehouse.*'  => ['nullable'],
            'items.*.referenceable.type'  => ['nullable', 'string', Rule::in([AssetService::class, AssetServiceConsumedItem::class])],
            'items.*.referenceable.id'    => ['nullable', 'string', 'required_with:items.*.referenceable.type'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateAssetServiceReferenceables($validator);
            $this->validateSourceWarehouseRequired($validator);
        });
    }

    /**
     * Gudang Asal wajib diisi untuk baris ItemVariant yang is_stock_item —
     * item jasa (is_stock_item=false) tidak butuh gudang, kolomnya di-disable
     * di FE, jadi TIDAK boleh diwajibkan di sini juga.
     */
    private function validateSourceWarehouseRequired(Validator $validator): void {
        foreach ((array) $this->input('items', []) as $index => $item) {
            $itemVariantId = $item['item']['id'] ?? null;
            if (! $itemVariantId) {
                continue;
            }

            $itemVariant = ItemVariant::find($itemVariantId);
            if (! $itemVariant?->is_stock_item) {
                continue;
            }

            if (empty($item['source_warehouse']['id'] ?? null)) {
                $validator->errors()->add(
                    "items.{$index}.source_warehouse.id",
                    __('sales/salesOrder.source_warehouse_required'),
                );
            }
        }
    }

    /**
     * Requirement 2, spec asset-service-internal-order: baris InternalOrderItem
     * yang referenceable ke AssetService/AssetServiceConsumedItem hanya boleh
     * dibuat kalau AssetService terkait sudah APPROVED, dan tiap
     * AssetServiceConsumedItem hanya boleh dipakai SATU baris — dicek LINTAS
     * SalesOrderItem dan InternalOrderItem (Requirement 2.3).
     */
    private function validateAssetServiceReferenceables(Validator $validator): void {
        foreach ((array) $this->input('items', []) as $index => $item) {
            $type = $item['referenceable']['type'] ?? null;
            $id   = $item['referenceable']['id'] ?? null;

            if (! $type || ! $id) {
                continue;
            }

            if ($type === AssetService::class) {
                $assetService = AssetService::find($id);
                if (! $assetService || ! in_array(FormStatus::APPROVED, $assetService->status ?? [], true)) {
                    $validator->errors()->add(
                        "items.{$index}.referenceable.id",
                        __('sales/salesOrder.referenceable_not_approved'),
                    );
                }

                continue;
            }

            if ($type === AssetServiceConsumedItem::class) {
                $consumedItem = AssetServiceConsumedItem::with('assetService')->find($id);
                if (! $consumedItem || ! in_array(FormStatus::APPROVED, $consumedItem->assetService?->status ?? [], true)) {
                    $validator->errors()->add(
                        "items.{$index}.referenceable.id",
                        __('sales/salesOrder.referenceable_not_approved'),
                    );

                    continue;
                }

                $alreadyUsed = InternalOrderItem::where('referenceable_type', AssetServiceConsumedItem::class)
                    ->where('referenceable_id', $id)
                    ->where('id', '!=', $item['id'] ?? null)
                    ->exists()
                    || SalesOrderItem::where('referenceable_type', AssetServiceConsumedItem::class)
                        ->where('referenceable_id', $id)
                        ->exists();

                if ($alreadyUsed) {
                    $validator->errors()->add(
                        "items.{$index}.referenceable.id",
                        __('sales/salesOrder.referenceable_already_used'),
                    );
                }
            }
        }
    }
}
