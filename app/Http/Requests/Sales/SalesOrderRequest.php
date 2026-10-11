<?php

namespace App\Http\Requests\Sales;

use App\Http\Requests\Asset\AssetItems\AssetItemsRules;
use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrderItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class SalesOrderRequest extends BaseFormRequest {
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
        // Spec asset-items-section: rule `items.*` dicerminkan ke `asset_items.*`.
        // `items` sendiri opsional karena gabungan items + asset_items yang wajib
        // minimal 1 (dicek di withValidator).
        return [
            'date'           => ['required', 'date'],
            'rent_date.from' => [Rule::requiredIf($this->is_rent ?? false), 'date', 'nullable'],
            'rent_date.to'   => [
                Rule::requiredIf($this->is_rent ?? false),
                Rule::date()->afterOrEqual($this->start_date ?? now()),
                'date',
                'nullable',
            ],
            'is_rent'                           => ['nullable', 'boolean'],
            'customer.id'                       => [Rule::requiredIf(! ($this->is_rent ?? false)), new ExistsExcludingTrashed('customers')],
            'customer.*'                        => ['nullable'],
            'customer_branch.id'                => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'                 => ['nullable'],
            'reference_so.id'                   => ['nullable', new ExistsExcludingTrashed('sales_orders')],
            'reference_so.*'                    => ['nullable'],
            'items'                             => ['nullable', 'array'],
            'items.*.id'                        => ['required', 'string'],
            'items.*.item.id'                   => ['required', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'                    => ['nullable'],
            'items.*.description'               => ['nullable', 'string'],
            'items.*.quantity'                  => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                   => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                    => ['nullable'],
            'items.*.tax.id'                    => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'                     => ['nullable'],
            'items.*.price'                     => ['nullable', 'numeric'],
            'items.*.source_warehouse.id'       => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'items.*.referenceable.type'        => ['nullable', 'string', Rule::in([AssetService::class, AssetServiceConsumedItem::class])],
            'items.*.referenceable.id'          => ['nullable', 'string', 'required_with:items.*.referenceable.type'],
            'items.*.asset.id'                  => ['prohibited'],
            'asset_items'                       => ['nullable', 'array'],
            'asset_items.*.id'                  => ['required', 'string'],
            'asset_items.*.item.id'             => ['prohibited'],
            'asset_items.*.item.*'              => ['nullable'],
            'asset_items.*.asset.id'            => ['required', new ExistsExcludingTrashed('assets')],
            'asset_items.*.asset.*'             => ['nullable'],
            'asset_items.*.description'         => ['nullable', 'string'],
            'asset_items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'asset_items.*.tax.id'              => ['required', new ExistsExcludingTrashed('taxes')],
            'asset_items.*.tax.*'               => ['nullable'],
            'asset_items.*.price'               => ['nullable', 'numeric'],
            'asset_items.*.unit'                => ['prohibited'],
            'asset_items.*.source_warehouse.id' => ['prohibited'],
            'asset_items.*.referenceable.type'  => ['nullable', 'string', Rule::in([AssetService::class, AssetServiceConsumedItem::class])],
            'asset_items.*.referenceable.id'    => ['nullable', 'string', 'required_with:asset_items.*.referenceable.type'],
            'currency.code'                     => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                     => ['nullable', 'numeric'],
            'external_note'                     => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $buckets = $this->itemBuckets();

            AssetItemsRules::validateCombinedMinimum($validator, $buckets);
            AssetItemsRules::rejectLegacyAssetLines($validator, $buckets);
            AssetItemsRules::validateMembership(
                $validator,
                $buckets,
                fn (array $rows) => array_map(fn ($row) => $row['asset']['id'] ?? null, $rows),
                'asset',
            );

            $this->validateAssetServiceReferenceables($validator);
            $this->validateSourceWarehouseRequired($validator);
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
     * Gudang Asal wajib diisi untuk baris ItemVariant yang is_stock_item —
     * item jasa (is_stock_item=false) tidak butuh gudang, kolomnya di-disable
     * di FE, jadi TIDAK boleh diwajibkan di sini juga.
     */
    private function validateSourceWarehouseRequired(Validator $validator): void {
        foreach ($this->itemBuckets() as $bucket => $rows) {
            foreach ($rows as $index => $item) {
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
                        "{$bucket}.{$index}.source_warehouse.id",
                        __('sales/salesOrder.source_warehouse_required'),
                    );
                }
            }
        }
    }

    /**
     * Requirement 5, spec asset-service-billing: baris SalesOrderItem yang
     * referenceable ke AssetService/AssetServiceConsumedItem hanya boleh dibuat
     * kalau AssetService terkait sudah APPROVED, dan tiap AssetServiceConsumedItem
     * hanya boleh dipakai SATU baris SalesOrderItem (1:1, tidak boleh dobel).
     */
    private function validateAssetServiceReferenceables(Validator $validator): void {
        foreach ($this->itemBuckets() as $bucket => $rows) {
            foreach ($rows as $index => $item) {
                $type = $item['referenceable']['type'] ?? null;
                $id   = $item['referenceable']['id'] ?? null;

                if (! $type || ! $id) {
                    continue;
                }

                if ($type === AssetService::class) {
                    $assetService = AssetService::find($id);
                    if (! $assetService || ! $assetService->hasPassedApproval()) {
                        $validator->errors()->add(
                            "{$bucket}.{$index}.referenceable.id",
                            __('sales/salesOrder.referenceable_not_approved'),
                        );
                    }

                    continue;
                }

                if ($type === AssetServiceConsumedItem::class) {
                    $consumedItem = AssetServiceConsumedItem::with('assetService')->find($id);
                    if (! $consumedItem || ! $consumedItem->assetService?->hasPassedApproval()) {
                        $validator->errors()->add(
                            "{$bucket}.{$index}.referenceable.id",
                            __('sales/salesOrder.referenceable_not_approved'),
                        );

                        continue;
                    }

                    // Requirement 2.3, spec asset-service-internal-order: 1:1 harus
                    // dicek LINTAS SalesOrderItem DAN InternalOrderItem sekaligus.
                    $alreadyUsed = SalesOrderItem::where('referenceable_type', AssetServiceConsumedItem::class)
                        ->where('referenceable_id', $id)
                        ->where('id', '!=', $item['id'] ?? null)
                        ->exists()
                        || InternalOrderItem::where('referenceable_type', AssetServiceConsumedItem::class)
                            ->where('referenceable_id', $id)
                            ->exists();

                    if ($alreadyUsed) {
                        $validator->errors()->add(
                            "{$bucket}.{$index}.referenceable.id",
                            __('sales/salesOrder.referenceable_already_used'),
                        );
                    }
                }
            }
        }
    }
}
