<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Asset\AssetItems\AssetItemsRules;
use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Facades\DB;

class SalesInvoiceRequest extends BaseFormRequest {
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
        // Spec asset-items-section: rule `items.*` dicerminkan ke `asset_items.*`,
        // lalu kedua bucket diberi validasi identitas item/asset yang saling eksklusif.
        // `items` opsional karena gabungan items + asset_items yang
        // wajib minimal 1 (dicek di withValidator).
        return [
            'date'                                 => ['required', 'date'],
            'sales_order.id'                       => ['nullable', new ExistsExcludingTrashed('sales_orders')],
            'sales_order.*'                        => ['nullable'],
            'return_against.id'                    => ['nullable', new ExistsExcludingTrashed('sales_invoices')],
            'income_account.id'                    => ['required', new ExistsExcludingTrashed('accounts')],
            'debit_account.id'                     => ['required', new ExistsExcludingTrashed('accounts')],
            'customer.id'                          => ['required', new ExistsExcludingTrashed('customers')],
            'customer.*'                           => ['nullable'],
            'customer_branch.id'                   => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'                    => ['nullable'],
            'items'                                => ['nullable', 'array'],
            'items.*.id'                           => ['required', 'string'],
            'items.*.sales_order_item.id'          => ['required', new ExistsExcludingTrashed('sales_order_items')],
            'items.*.sales_order_item.*'           => ['nullable'],
            'items.*.description'                  => ['nullable', 'string'],
            'items.*.quantity'                     => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                      => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                       => ['nullable'],
            'items.*.tax.id'                       => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'                        => ['nullable'],
            'items.*.price'                        => ['nullable', 'numeric'],
            'items.*.return_against_item_id'       => ['nullable', new ExistsExcludingTrashed('sales_invoice_items')],
            'items.*.asset.id'                     => ['prohibited'],
            'asset_items'                          => ['nullable', 'array'],
            'asset_items.*.id'                     => ['required', 'string'],
            'asset_items.*.sales_order_item.id'    => ['required', new ExistsExcludingTrashed('sales_order_items')],
            'asset_items.*.sales_order_item.*'     => ['nullable'],
            'asset_items.*.description'            => ['nullable', 'string'],
            'asset_items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'asset_items.*.tax.id'                 => ['required', new ExistsExcludingTrashed('taxes')],
            'asset_items.*.tax.*'                  => ['nullable'],
            'asset_items.*.price'                  => ['nullable', 'numeric'],
            'asset_items.*.return_against_item_id' => ['nullable', new ExistsExcludingTrashed('sales_invoice_items')],
            'asset_items.*.item.id'                => ['prohibited'],
            'asset_items.*.asset.id'               => ['required', new ExistsExcludingTrashed('assets')],
            'asset_items.*.asset.*'                => ['nullable'],
            'asset_items.*.unit'                   => ['prohibited'],
            'currency.code'                        => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                        => ['nullable', 'numeric'],
            'external_note'                        => ['nullable', 'string'],
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
                fn (array $rows) => $this->assetIdsOf($rows),
                'sales_order_item',
            );
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
     * asset_id per baris, lewat SalesOrderItem yang dirujuk baris SI.
     *
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function assetIdsOf(array $rows): array {
        $salesOrderItemIds = array_values(array_filter(array_map(
            fn ($row) => $row['sales_order_item']['id'] ?? null,
            $rows,
        )));

        $assetBySalesOrderItem = $salesOrderItemIds === []
            ? collect()
            : DB::table('sales_order_items')->whereIn('id', $salesOrderItemIds)->pluck('asset_id', 'id');

        return array_map(function ($row) use ($assetBySalesOrderItem) {
            $id = $row['sales_order_item']['id'] ?? null;

            return $id ? ($assetBySalesOrderItem[$id] ?? null) : null;
        }, $rows);
    }
}
