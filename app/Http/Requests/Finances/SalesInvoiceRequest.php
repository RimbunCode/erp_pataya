<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Http\Requests\Finances\Rules\ReturnAgainstItemRules;
use App\Http\Requests\Sales\Rules\OffSourceItemRules;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\ItemUnit;
use App\Models\Sales\SalesOrderItem;
use App\Models\Sales\SalesSetting;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Core\Setting\RateChangeComparator;
use App\Services\Core\Setting\ToleranceCalculator;
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
     * Spec delivery-note-sales-invoice-off-source-items: satu `items[]`, tiap baris
     * punya salah satu dari tiga sumber -- baris SO (`sales_order_item.id`), `item.id`
     * (ItemVariant bebas), atau `asset.id` (Asset bebas). Bila lebih dari satu,
     * prioritas baris SO > item > asset (sama dengan SalesInvoiceService).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'date'                           => ['required', 'date'],
            'sales_order.id'                 => ['nullable', new ExistsExcludingTrashed('sales_orders')],
            'sales_order.*'                  => ['nullable'],
            'return_against.id'              => ['nullable', new ExistsExcludingTrashed('sales_invoices')],
            'income_account.id'              => ['required', new ExistsExcludingTrashed('accounts')],
            'debit_account.id'               => ['required', new ExistsExcludingTrashed('accounts')],
            'customer.id'                    => ['required', new ExistsExcludingTrashed('customers')],
            'customer.*'                     => ['nullable'],
            'customer_branch.id'             => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'              => ['nullable'],
            'items'                          => ['required', 'array', 'min:1'],
            'items.*.id'                     => ['required', 'string'],
            'items.*.sales_order_item.id'    => ['nullable', 'required_without_all:items.*.item.id,items.*.asset.id', new ExistsExcludingTrashed('sales_order_items')],
            'items.*.sales_order_item.*'     => ['nullable'],
            'items.*.item.id'                => ['nullable', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'                 => ['nullable'],
            'items.*.asset.id'               => ['nullable', new ExistsExcludingTrashed('assets')],
            'items.*.asset.*'                => ['nullable'],
            'items.*.description'            => ['nullable', 'string'],
            'items.*.quantity'               => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'                => ['nullable', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'                 => ['nullable'],
            'items.*.tax.id'                 => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'                  => ['nullable'],
            'items.*.price'                  => ['nullable', 'numeric', 'required_without:items.*.sales_order_item.id'],
            'items.*.return_against_item_id' => ['nullable', new ExistsExcludingTrashed('sales_invoice_items')],
            'currency.code'                  => ['nullable', 'exists:currencies,code'],
            'exchange_rate'                  => ['nullable', 'numeric'],
            'external_note'                  => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $rows     = (array) $this->input('items', []);
            $assetIds = $this->sourceAssetIdsOf($rows);
            $isReturn = filled($this->input('return_against.id'));
            ReturnAgainstItemRules::validate($validator, $rows, $this->input('return_against.id'), 'sales_invoice_items', 'sales_invoice_id', 'sales_invoices', [
                'sales_order_item.id' => 'sales_order_item_id',
                'item.id'             => 'item_id',
                'asset.id'            => 'asset_id',
                'unit.id'             => 'item_unit_id',
            ]);
            $freeRows  = [];
            $freeAsset = [];

            foreach ($rows as $index => $row) {
                $hasSource = filled($row['sales_order_item']['id'] ?? null);
                $assetId   = $hasSource ? ($assetIds[$index] ?? null) : ($row['asset']['id'] ?? null);
                $isAsset   = filled($assetId) && ($hasSource || blank($row['item']['id'] ?? null));

                if (! $hasSource) {
                    $freeRows[] = $index;
                    if ($isAsset) {
                        $freeAsset[$index] = $assetId;
                    }
                }

                if ($isAsset) {
                    $this->validateAssetRow($validator, $index, $row, $hasSource, $assetId, $isReturn);
                } elseif (blank($row['unit']['id'] ?? null)) {
                    $validator->errors()->add("items.{$index}.unit.id", __('validation.required', ['attribute' => 'unit']));
                }
            }

            // Baris di luar SO: izin khusus, Asset aktif dan belum ada di SI submitted lain;
            // baris SO harus milik SO header.
            OffSourceItemRules::validatePermission($validator, $this, SalesInvoice::class, $freeRows);
            OffSourceItemRules::validateFreeAssets($validator, $freeAsset, 'sales_invoice_items', 'sales_invoices', 'sales_invoice_id');
            OffSourceItemRules::validateSourceBelongsToHeader($validator, $this->sourceOrderOf($rows), $this->input('sales_order.id'), 'sales_order_item.id');

            if (! $isReturn) {
                $this->validateRateChanges($validator, $rows);
                $this->validateBillingTolerance($validator, $rows);
            }
        });
    }

    /** @param array<int|string,mixed> $rows */
    private function validateBillingTolerance(Validator $validator, array $rows): void {
        $tolerance = SalesSetting::current()->over_billing_tolerance_percent;
        if ($tolerance === null) {
            return;
        }

        $groupedRows = collect($rows)
            ->filter(fn ($row) => filled($row['sales_order_item']['id'] ?? null))
            ->groupBy('sales_order_item.id');
        if ($groupedRows->isEmpty()) {
            return;
        }

        $sourceItems = SalesOrderItem::query()
            ->with('salesOrder:id,exchange_rate')
            ->whereIn('id', $groupedRows->keys())
            ->get()
            ->keyBy('id');
        $calculator   = app(ToleranceCalculator::class);
        $exchangeRate = (float) ($this->input('exchange_rate') ?: 1);

        foreach ($groupedRows as $sourceId => $sourceRows) {
            $source = $sourceItems->get($sourceId);
            if (! $source) {
                continue;
            }

            $requestedQuantity  = $sourceRows->sum(fn ($row) => (float) $row['quantity']);
            $sourceExchangeRate = (float) ($source->salesOrder?->exchange_rate ?: 1);
            $sourceUnitValue    = (float) $source->price * $sourceExchangeRate;
            $requestedValue     = $sourceRows->sum(fn ($row) => (float) ($row['quantity'] * ($row['price'] ?? $source->price) * $exchangeRate));
            $alreadyBilledValue = (float) $source->billed_quantity * $sourceUnitValue;
            $index              = $sourceRows->keys()->first();

            if ($calculator->exceeds($requestedQuantity, (float) $source->quantity, (float) $source->billed_quantity, $tolerance)) {
                $validator->errors()->add("items.{$index}.quantity", __('finances/salesInvoice.validation.over_billing_tolerance_exceeded', [
                    'remaining' => max(0, (float) $source->quantity - (float) $source->billed_quantity),
                    'tolerance' => $tolerance,
                ]));
            }

            if ($calculator->exceedsValue($requestedValue, (float) $source->basic_amount_base_currency, $alreadyBilledValue, $tolerance)) {
                $validator->errors()->add("items.{$index}.price", __('finances/salesInvoice.validation.over_billing_value_tolerance_exceeded', [
                    'tolerance' => $tolerance,
                ]));
            }
        }
    }

    /** @param array<int|string,mixed> $rows */
    private function validateRateChanges(Validator $validator, array $rows): void {
        $action = SalesSetting::current()->rate_change_action;
        if ($action === 'none') {
            return;
        }

        $groupedRows = collect($rows)
            ->filter(fn ($row) => filled($row['sales_order_item']['id'] ?? null))
            ->groupBy('sales_order_item.id');
        $sourceItems = $groupedRows->isEmpty()
            ? collect()
            : SalesOrderItem::query()
                ->with('salesOrder:id,exchange_rate')
                ->whereIn('id', $groupedRows->keys())
                ->get()
                ->keyBy('id');
        $unitIds     = collect($rows)->pluck('unit.id')->filter()->unique();
        $unitFactors = $unitIds->isEmpty()
            ? collect()
            : ItemUnit::whereIn('item_units.id', $unitIds)->pluck('item_units.conversion_factor', 'item_units.id');
        $exchangeRate = (float) ($this->input('exchange_rate') ?: 1);
        $comparator   = app(RateChangeComparator::class);
        $warnings     = [];

        foreach ($groupedRows as $sourceId => $sourceRows) {
            $source = $sourceItems->get($sourceId);
            if (! $source) {
                continue;
            }

            foreach ($sourceRows as $index => $row) {
                $documentRate   = (float) ($row['price'] ?? $source->price);
                $documentFactor = (float) ($unitFactors[$row['unit']['id'] ?? ''] ?? $source->conversion_factor ?: 1);
                if (! $comparator->hasChanged(
                    (float) $source->price,
                    (float) ($source->salesOrder?->exchange_rate ?: 1),
                    (float) ($source->conversion_factor ?: 1),
                    $documentRate,
                    $exchangeRate,
                    $documentFactor,
                )) {
                    continue;
                }

                $message = __('finances/salesInvoice.validation.rate_changed', [
                    'source'   => $source->price,
                    'document' => $documentRate,
                ]);
                if ($action === 'stop') {
                    $validator->errors()->add("items.{$index}.price", $message);
                } else {
                    $warnings[] = $message;
                }
            }
        }

        if ($warnings !== [] && $this->hasSession()) {
            $this->session()->flash('priceWarnings', array_values(array_unique($warnings)));
        }
    }

    /**
     * Baris Asset: tanpa unit. Baris Asset dari SO harus cocok dengan asset baris SO;
     * baris Asset bebas dijual dan tidak dapat diretur.
     *
     * @param  array<string,mixed>  $row
     */
    private function validateAssetRow(Validator $validator, int|string $index, array $row, bool $hasSource, string $assetId, bool $isReturn): void {
        if (filled($row['unit']['id'] ?? null)) {
            $validator->errors()->add("items.{$index}.unit.id", __('finances/salesInvoice.asset_row_no_unit'));
        }

        if (! $hasSource) {
            if ($isReturn) {
                $validator->errors()->add("items.{$index}.asset.id", __('finances/salesInvoice.free_asset_cannot_be_returned'));
            }

            return;
        }

        if (filled($row['asset']['id'] ?? null) && $row['asset']['id'] !== $assetId) {
            $validator->errors()->add("items.{$index}.asset.id", __('asset/asset.item_mismatch'));
        }
    }

    /**
     * Id SO pemilik tiap baris SO (dari DB).
     *
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function sourceOrderOf(array $rows): array {
        $ids = array_values(array_filter(array_map(fn ($row) => $row['sales_order_item']['id'] ?? null, $rows)));
        $map = $ids === [] ? collect() : DB::table('sales_order_items')->whereIn('id', $ids)->pluck('sales_order_id', 'id');

        $owners = [];
        foreach ($rows as $index => $row) {
            $id = $row['sales_order_item']['id'] ?? null;
            if (filled($id)) {
                $owners[$index] = $map[$id] ?? null;
            }
        }

        return $owners;
    }

    /**
     * asset_id per baris SO, lewat SalesOrderItem yang dirujuk baris SI (baris
     * tanpa sumber SO tidak diisi).
     *
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function sourceAssetIdsOf(array $rows): array {
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
