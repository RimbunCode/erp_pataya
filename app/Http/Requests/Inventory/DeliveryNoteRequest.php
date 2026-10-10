<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\Asset\AssetItems\AssetItemsRules;
use App\Http\Requests\BaseFormRequest;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Facades\DB;
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
        // Spec asset-items-section: rule `items.*` dicerminkan ke `asset_items.*`;
        // kedua bucket tetap memilih source item melalui referenceable.
        return [
            'return_against.id'                    => ['nullable', new ExistsExcludingTrashed('delivery_notes')],
            'customer.id'                          => [Rule::requiredIf($this->input('reference_to.model') === SalesOrder::class), new ExistsExcludingTrashed('customers')],
            'customer_branch.id'                   => ['required', new ExistsExcludingTrashed('branches')],
            'reference_to.id'                      => ['required', 'string', new ExistsExcludingTrashed('permissions')],
            'reference_to.*'                       => ['nullable'],
            'referenceable_id'                     => ['required', 'string'],
            'referenceable_type'                   => ['required', Rule::in([SalesOrder::class, InternalOrder::class])],
            'delivery_date'                        => ['required', 'date'],
            'items.*'                              => ['required', 'array', 'min:1'],
            'items.*.id'                           => ['required', 'string'],
            'items.*.source_warehouse.id'          => ['required', new ExistsExcludingTrashed('warehouses')],
            'items.*.referenceable_id'             => ['required', 'string'],
            'items.*.referenceable_type'           => ['required', Rule::in([SalesOrderItem::class, InternalOrderItem::class])],
            'items.*.description'                  => ['nullable', 'string'],
            'items.*.quantity'                     => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                      => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                       => ['nullable'],
            'items.*.return_against_item.id'       => ['nullable', new ExistsExcludingTrashed('delivery_note_items')],
            'items.*.asset.id'                     => ['prohibited'],
            'asset_items'                          => ['nullable', 'array'],
            'asset_items.*'                        => ['required', 'array', 'min:1'],
            'asset_items.*.id'                     => ['required', 'string'],
            'asset_items.*.source_warehouse.id'    => ['prohibited'],
            'asset_items.*.referenceable_id'       => ['required', 'string'],
            'asset_items.*.referenceable_type'     => ['required', Rule::in([SalesOrderItem::class])],
            'asset_items.*.description'            => ['nullable', 'string'],
            'asset_items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'asset_items.*.return_against_item.id' => ['nullable', new ExistsExcludingTrashed('delivery_note_items')],
            'asset_items.*.item.id'                => ['prohibited'],
            'asset_items.*.asset.id'               => ['required', new ExistsExcludingTrashed('assets')],
            'asset_items.*.asset.*'                => ['nullable'],
            'asset_items.*.unit'                   => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $buckets = $this->itemBuckets();

            // Tanpa validateCombinedMinimum: DN tidak punya aturan minimal-1 di level
            // list `items` sebelum fitur ini, dan tidak diperketat di sini (keputusan D5).
            AssetItemsRules::rejectLegacyAssetLines($validator, $buckets);
            AssetItemsRules::validateMembership(
                $validator,
                $buckets,
                fn (array $rows) => $this->assetIdsOf($rows),
                'referenceable_id',
            );

            $this->validateAssetServiceConsumedItemQuantity($validator);
            $this->validateAssetItemsAreRentable($validator);
            $assetIds = $this->assetIdsOf($buckets['asset_items']);
            foreach ($buckets['asset_items'] as $index => $row) {
                if (($row['asset']['id'] ?? null) !== ($assetIds[$index] ?? null)) {
                    $validator->errors()->add("asset_items.{$index}.asset.id", __('asset/asset.item_mismatch'));
                }
            }
        });
    }

    /**
     * @return array{items: array<int|string,mixed>, asset_items: array<int|string,mixed>}
     */
    private function itemBuckets(): array {
        return [
            'items'       => (array) $this->input('items', []),
            'asset_items' => (array) $this->input('asset_items', []),
        ];
    }

    /**
     * asset_id per baris, lewat SalesOrderItem yang dirujuk.
     *
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function assetIdsOf(array $rows): array {
        $ids = array_values(array_filter(array_map(
            fn ($row) => ($row['referenceable_type'] ?? null) === SalesOrderItem::class
                ? ($row['referenceable_id'] ?? null)
                : null,
            $rows,
        )));
        $assetBySource = $ids === [] ? collect() : DB::table('sales_order_items')->whereIn('id', $ids)->pluck('asset_id', 'id');

        return array_map(fn ($row) => $assetBySource[$row['referenceable_id'] ?? ''] ?? null, $rows);
    }

    private function validateAssetItemsAreRentable(Validator $validator): void {
        $rows     = $this->itemBuckets()['asset_items'];
        $assetIds = array_values(array_unique(array_filter(array_map(
            fn (array $row) => $row['asset']['id'] ?? null,
            $rows,
        ))));
        if ($assetIds === []) {
            return;
        }

        $nonRentableIds = DB::table('assets')
            ->whereIn('id', $assetIds)
            ->where('is_rentable', false)
            ->pluck('id')
            ->flip();

        foreach ($rows as $index => $row) {
            $assetId = $row['asset']['id'] ?? null;
            if ($assetId !== null && $nonRentableIds->has($assetId)) {
                $validator->errors()->add(
                    "asset_items.{$index}.asset.id",
                    __('asset/asset.asset_not_rentable'),
                );
            }
        }
    }

    /**
     * Requirement 8.1, spec asset-service-billing; Requirement 3.4, spec
     * asset-service-internal-order: baris DeliveryNoteItem yang SalesOrderItem
     * ATAU InternalOrderItem asalnya referenceable ke AssetServiceConsumedItem
     * tidak boleh mengambil quantity melebihi part yang sebenarnya dipakai.
     */
    private function validateAssetServiceConsumedItemQuantity(Validator $validator): void {
        foreach ($this->itemBuckets() as $bucket => $rows) {
            foreach ($rows as $index => $item) {
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
                        "{$bucket}.{$index}.quantity",
                        __('asset/service.consumed_item_quantity_exceeded'),
                    );
                }
            }
        }
    }
}
