<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Sales\Rules\OffSourceItemRules;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\DeliveryNote;
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
     * Spec delivery-note-sales-invoice-off-source-items: satu `items[]`, tiap baris
     * punya salah satu dari tiga sumber -- baris SO/IO (`referenceable_id`), `item.id`
     * (ItemVariant bebas), atau `asset.id` (Asset bebas). Bila lebih dari satu,
     * prioritas baris SO > item > asset (sama dengan DeliveryNoteService).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'return_against.id'              => ['nullable', new ExistsExcludingTrashed('delivery_notes')],
            'customer.id'                    => [Rule::requiredIf($this->input('reference_to.model') === SalesOrder::class), new ExistsExcludingTrashed('customers')],
            'customer_branch.id'             => ['required', new ExistsExcludingTrashed('branches')],
            'reference_to.id'                => ['required', 'string', new ExistsExcludingTrashed('permissions')],
            'reference_to.*'                 => ['nullable'],
            'referenceable_id'               => ['required', 'string'],
            'referenceable_type'             => ['required', Rule::in([SalesOrder::class, InternalOrder::class])],
            'delivery_date'                  => ['required', 'date'],
            'items.*'                        => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.source_warehouse.id'    => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'items.*.referenceable_id'       => ['nullable', 'string', 'required_without_all:items.*.item.id,items.*.asset.id'],
            'items.*.referenceable_type'     => ['nullable', 'required_with:items.*.referenceable_id', Rule::in([SalesOrderItem::class, InternalOrderItem::class])],
            'items.*.item.id'                => ['nullable', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'                 => ['nullable'],
            'items.*.asset.id'               => ['nullable', new ExistsExcludingTrashed('assets')],
            'items.*.asset.*'                => ['nullable'],
            'items.*.description'            => ['nullable', 'string'],
            'items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                => ['nullable', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.return_against_item.id' => ['nullable', new ExistsExcludingTrashed('delivery_note_items')],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $rows      = (array) $this->input('items', []);
            $assetIds  = $this->sourceAssetIdsOf($rows);
            $isReturn  = filled($this->input('return_against.id'));
            $rentables = $this->nonRentableAssetIds($rows, $assetIds);
            $freeRows  = [];
            $freeAsset = [];

            foreach ($rows as $index => $row) {
                $hasSource = filled($row['referenceable_id'] ?? null);
                $assetId   = $hasSource ? ($assetIds[$index] ?? null) : ($row['asset']['id'] ?? null);
                $isAsset   = filled($assetId) && ($hasSource || blank($row['item']['id'] ?? null));

                if (! $hasSource) {
                    $freeRows[] = $index;
                    if ($isAsset) {
                        $freeAsset[$index] = $assetId;
                    }
                }

                if ($isAsset) {
                    $this->validateAssetRow($validator, $index, $row, $hasSource, $assetId, $isReturn, $rentables);
                } else {
                    $this->validateItemRow($validator, $index, $row);
                }
            }

            $this->validateAssetServiceConsumedItemQuantity($validator);

            // Baris di luar SO/IO: izin khusus, Asset aktif dan belum ada di DN submitted lain;
            // baris sumber harus milik header.
            OffSourceItemRules::validatePermission($validator, $this, DeliveryNote::class, $freeRows);
            OffSourceItemRules::validateFreeAssets($validator, $freeAsset, 'delivery_note_items', 'delivery_notes', 'delivery_note_id');
            OffSourceItemRules::validateSourceBelongsToHeader($validator, $this->sourceOwnersOf($rows), $this->input('referenceable_id'), 'referenceable_id');
        });
    }

    /**
     * Baris ItemVariant (dari SO/IO maupun bebas): gudang asal dan unit wajib.
     *
     * @param  array<string,mixed>  $row
     */
    private function validateItemRow(Validator $validator, int|string $index, array $row): void {
        if (blank($row['source_warehouse']['id'] ?? null)) {
            $validator->errors()->add("items.{$index}.source_warehouse.id", __('validation.required', ['attribute' => 'source warehouse']));
        }
        if (blank($row['unit']['id'] ?? null)) {
            $validator->errors()->add("items.{$index}.unit.id", __('validation.required', ['attribute' => 'unit']));
        }
    }

    /**
     * Baris Asset: tanpa unit/gudang. Baris Asset dari SO harus cocok dengan asset
     * baris SO dan rentable (alur sewa); baris Asset bebas dijual -- tidak wajib
     * rentable dan tidak boleh diretur.
     *
     * @param  array<string,mixed>  $row
     * @param  array<string,bool>  $nonRentable
     */
    private function validateAssetRow(Validator $validator, int|string $index, array $row, bool $hasSource, string $assetId, bool $isReturn, array $nonRentable): void {
        foreach (['unit.id' => $row['unit']['id'] ?? null, 'source_warehouse.id' => $row['source_warehouse']['id'] ?? null] as $field => $value) {
            if (filled($value)) {
                $validator->errors()->add("items.{$index}.{$field}", __('inventory/deliveryNote.asset_row_no_unit_warehouse'));
            }
        }

        if (! $hasSource) {
            if ($isReturn) {
                $validator->errors()->add("items.{$index}.asset.id", __('inventory/deliveryNote.free_asset_cannot_be_returned'));
            }

            return;
        }

        if (($row['asset']['id'] ?? null) !== null && $row['asset']['id'] !== $assetId) {
            $validator->errors()->add("items.{$index}.asset.id", __('asset/asset.item_mismatch'));
        }
        if (isset($nonRentable[$assetId])) {
            $validator->errors()->add("items.{$index}.asset.id", __('asset/asset.asset_not_rentable'));
        }
    }

    /**
     * asset_id per baris SO, lewat SalesOrderItem yang dirujuk (baris tanpa
     * sumber SO tidak diisi).
     *
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function sourceAssetIdsOf(array $rows): array {
        $ids = array_values(array_filter(array_map(
            fn ($row) => ($row['referenceable_type'] ?? null) === SalesOrderItem::class
                ? ($row['referenceable_id'] ?? null)
                : null,
            $rows,
        )));
        $assetBySource = $ids === [] ? collect() : DB::table('sales_order_items')->whereIn('id', $ids)->pluck('asset_id', 'id');

        return array_map(
            fn ($row) => ($row['referenceable_type'] ?? null) === SalesOrderItem::class
                ? ($assetBySource[$row['referenceable_id'] ?? ''] ?? null)
                : null,
            $rows,
        );
    }

    /**
     * Id dokumen pemilik tiap baris sumber (SO/IO) dari DB; baris yang tipenya tidak cocok
     * dengan tipe header diberi penanda agar ditolak.
     *
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function sourceOwnersOf(array $rows): array {
        $expected = [
            SalesOrder::class    => SalesOrderItem::class,
            InternalOrder::class => InternalOrderItem::class,
        ][$this->input('referenceable_type')] ?? null;

        $owners = [];
        foreach ($rows as $index => $row) {
            $type = $row['referenceable_type'] ?? null;
            $id   = $row['referenceable_id'] ?? null;
            if (blank($id)) {
                continue;
            }
            if ($type !== $expected) {
                $owners[$index] = '__type_mismatch__';

                continue;
            }
            $owners[$index] = $type === SalesOrderItem::class
                ? DB::table('sales_order_items')->where('id', $id)->value('sales_order_id')
                : DB::table('internal_order_items')->where('id', $id)->value('internal_order_id');
        }

        return $owners;
    }

    /**
     * Id Asset (dari baris SO) yang tidak rentable, untuk validasi alur sewa.
     *
     * @param  array<int|string,mixed>  $rows
     * @param  array<int|string,?string>  $assetIds
     * @return array<string,bool>
     */
    private function nonRentableAssetIds(array $rows, array $assetIds): array {
        $ids = array_values(array_unique(array_filter($assetIds)));
        if ($ids === []) {
            return [];
        }

        return DB::table('assets')->whereIn('id', $ids)->where('is_rentable', false)
            ->pluck('id')->flip()->map(fn () => true)->all();
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
