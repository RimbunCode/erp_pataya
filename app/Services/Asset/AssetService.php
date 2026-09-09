<?php

namespace App\Services\Asset;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Model;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Asset\Depreciation\DepreciationScheduleGenerator;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use LogicException;

class AssetService implements SubmitableService {
    public function create(array $data): Model {
        DB::beginTransaction();

        try {
            $asset = $this->createInTransaction($data);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $asset;
    }

    private function createInTransaction(array $data): Model {
        $data = $this->applyPurchaseLinkOverrides($this->flattenRelationFields($data));

        return Asset::create([
            'code' => FormatingSeries::generate(Asset::class, $data, true),
            ...Arr::only($data, [
                'asset_name', 'asset_category_id', 'asset_location_id',
                'asset_type', 'item_id', 'asset_quantity',
                'is_rentable', 'allow_bulk_quantity',
                'ownership_type', 'ownership_company_id',
                'ownership_supplier_id', 'ownership_customer_id',
                'custodian_id',
                'purchase_date', 'available_for_use_date',
                'net_purchase_amount', 'gross_purchase_amount',
                'additional_asset_cost',
                'purchase_receipt_id', 'purchase_invoice_id',
                'purchase_receipt_item_id', 'purchase_invoice_item_id',
                'calculate_depreciation', 'is_depreciable',
                'depreciation_method', 'frequency_of_depreciation',
                'total_number_of_depreciations', 'next_depreciation_date',
                'expected_value_after_useful_life', 'salvage_value_percentage',
                'rate_of_depreciation', 'daily_prorata_based',
                'maintenance_required',
                'insurance_policy_number', 'insurance_insurer',
                'insurance_insured_value', 'insurance_start_date',
                'insurance_end_date', 'insurance_comprehensive',
            ]),
        ]);
    }

    public function update(Model $model, array $data): Model {
        DB::beginTransaction();

        try {
            $data = $this->applyPurchaseLinkOverrides($this->flattenRelationFields($data));
            $model->fill(Arr::only($data, [
                'asset_name', 'asset_category_id', 'asset_location_id',
                'item_id', 'asset_quantity',
                'is_rentable', 'allow_bulk_quantity',
                'ownership_type', 'ownership_company_id',
                'ownership_supplier_id', 'ownership_customer_id',
                'custodian_id',
                'purchase_date', 'available_for_use_date',
                'net_purchase_amount', 'gross_purchase_amount',
                'additional_asset_cost',
                'purchase_receipt_id', 'purchase_invoice_id',
                'purchase_receipt_item_id', 'purchase_invoice_item_id',
                'calculate_depreciation', 'is_depreciable',
                'depreciation_method', 'frequency_of_depreciation',
                'total_number_of_depreciations', 'next_depreciation_date',
                'expected_value_after_useful_life', 'salvage_value_percentage',
                'rate_of_depreciation', 'daily_prorata_based',
                'maintenance_required',
                'insurance_policy_number', 'insurance_insurer',
                'insurance_insured_value', 'insurance_start_date',
                'insurance_end_date', 'insurance_comprehensive',
            ]));

            $model->save();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $model;
    }

    public function delete(Model $model): void {
        $model->delete();
    }

    /**
     * Frontend mengirim relasi (asset_category, asset_location) sebagai objek
     * LinkModel utuh ({id, ...}), bukan string id flat. Ekstrak `.id` ke key
     * `_id` yang dikonsumsi Arr::only() di atas, sama seperti pola
     * PurchaseOrderService::fillItemRelations().
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    /**
     * Override asset_quantity/purchase_date dari Purchase Receipt Item, dan
     * net_purchase_amount/gross_purchase_amount dari Purchase Invoice Item,
     * saat link manual diisi (spec asset-management-purchase-integration-v2,
     * Requirement 3) -- SELALU dari data server, bukan trust nilai yang
     * dikirim FE (kolom rate/amount PurchaseInvoiceItem bisa ter-gate
     * `visibleFor` untuk user tanpa akses Purchase, target utama fitur ini).
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function applyPurchaseLinkOverrides(array $data): array {
        if (! empty($data['purchase_receipt_item_id'])) {
            $receiptItem = PurchaseReceiptItem::with('purchaseReceipt')->find($data['purchase_receipt_item_id']);
            if ($receiptItem) {
                $data['asset_quantity'] = $receiptItem->quantity;
                $data['purchase_date']  = $receiptItem->purchaseReceipt?->date ?? ($data['purchase_date'] ?? null);
            }
        }

        if (! empty($data['purchase_invoice_item_id'])) {
            $invoiceItem = PurchaseInvoiceItem::with('purchaseInvoice')->find($data['purchase_invoice_item_id']);
            if ($invoiceItem) {
                $data['net_purchase_amount']   = $invoiceItem->basic_amount;
                $data['gross_purchase_amount'] = $invoiceItem->amount;
                // Tanggal Receipt lebih relevan (barang benar-benar diterima)
                // -- hanya pakai tanggal invoice kalau belum di-set dari Receipt.
                $data['purchase_date'] ??= $invoiceItem->purchaseInvoice?->date;
            }
        }

        return $data;
    }

    private function flattenRelationFields(array $data): array {
        if (isset($data['asset_category']['id'])) {
            $data['asset_category_id'] = $data['asset_category']['id'];
        }
        if (isset($data['asset_location']['id'])) {
            $data['asset_location_id'] = $data['asset_location']['id'];
        }
        // item/custodian/ownership_supplier/ownership_customer nullable (bisa
        // dikosongkan user) -- array_key_exists, bukan isset(...['id']), supaya
        // pengiriman null ikut mengosongkan kolom _id, bukan diabaikan Arr::only().
        if (array_key_exists('item', $data)) {
            $data['item_id'] = $data['item']['id'] ?? null;
        }
        if (array_key_exists('custodian', $data)) {
            $data['custodian_id'] = $data['custodian']['id'] ?? null;
        }
        if (array_key_exists('ownership_supplier', $data)) {
            $data['ownership_supplier_id'] = $data['ownership_supplier']['id'] ?? null;
        }
        if (array_key_exists('ownership_customer', $data)) {
            $data['ownership_customer_id'] = $data['ownership_customer']['id'] ?? null;
        }

        return $data;
    }

    public function submit(Model $model): mixed {
        $missingFields = [];
        if (! $model->asset_category_id) {
            $missingFields[] = __('asset/asset.columns.asset_category');
        }
        if (! $model->asset_location_id) {
            $missingFields[] = __('asset/asset.columns.asset_location');
        }
        if (! $model->item_id) {
            $missingFields[] = __('asset/asset.columns.item_id');
        }
        $hasPurchaseHistory = $model->purchase_receipt_id || $model->purchase_invoice_id;
        if ($hasPurchaseHistory && ! ($model->purchase_receipt_id && $model->purchase_invoice_id)) {
            $missingFields[] = __('asset/asset.purchase_receipt_or_invoice');
        }
        if ($missingFields !== []) {
            throw new LogicException(__('asset/asset.cannot_submit_incomplete', [
                'fields' => implode(', ', $missingFields),
            ]));
        }

        DB::beginTransaction();

        try {
            $model->update([
                'code' => FormatingSeries::generate(Asset::class, $model),
            ]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $model->checkApproval();
    }

    public function cancel(Model $model): mixed {
        // ponytail: Asset doesn't support cancel — ERPNext parity
        throw new LogicException(__('asset/asset.cannot_cancel'));
    }

    public function amend(Model $model): mixed {
        return $model->amend();
    }

    public function onApproved(Model $model): mixed {
        $status = $model->status ?? [];
        // Remove DRAFT, add SUBMITTED
        $statusValues   = array_map(fn (FormStatus $s) => $s->value, $status);
        $statusValues   = array_values(array_diff($statusValues, [FormStatus::DRAFT->value]));
        $statusValues[] = FormStatus::SUBMITTED->value;

        // ponytail: auto-active if available_for_use_date already reached
        if ($model->available_for_use_date && $model->available_for_use_date->lte(now())) {
            $statusValues   = array_values(array_diff($statusValues, [FormStatus::SUBMITTED->value]));
            $statusValues[] = FormStatus::ACTIVE->value;
        }

        // Convert back to enum objects for FormStatusesCast
        $model->update(['status' => array_map(fn (string $v) => FormStatus::from($v), $statusValues)]);

        if ($model->calculate_depreciation) {
            app(DepreciationScheduleGenerator::class)->generate($model);
        }

        return null;
    }

    public function onRejected(Model $model): mixed {
        // Kembalikan ke Draft
        $model->update([
            'status' => [FormStatus::DRAFT],
        ]);

        return null;
    }

    /**
     * Split an Asset into N rows, each with its own category/location/quantity.
     * Monetary fields divided proportionally by quantity ratio per row.
     * Original asset is soft-deleted after split.
     *
     * @param  array<int, array{asset_category_id: string, asset_location_id: string, quantity: int|float}>  $rows
     * @return Collection<int, Asset>
     */
    public function split(Asset $asset, array $rows): Collection {
        $totalQuantity = array_sum(array_column($rows, 'quantity'));
        if (abs($totalQuantity - $asset->asset_quantity) > 0.0001) {
            throw new LogicException(__('asset/asset.split_quantity_mismatch', [
                'total'    => $totalQuantity,
                'expected' => $asset->asset_quantity,
            ]));
        }

        $results = collect();

        DB::transaction(function () use ($asset, $rows, &$results) {
            foreach ($rows as $row) {
                $partQty = (float) $row['quantity'];
                $ratio   = $asset->asset_quantity > 0 ? $partQty / $asset->asset_quantity : 0;

                $newAsset = Asset::create([
                    'code'                             => FormatingSeries::generate(Asset::class, $asset->attributesToArray(), true),
                    'asset_name'                       => $asset->asset_name,
                    'asset_category_id'                => $row['asset_category_id'],
                    'asset_location_id'                => $row['asset_location_id'],
                    'asset_type'                       => $asset->asset_type,
                    'item_id'                          => $asset->item_id,
                    'asset_quantity'                   => $partQty,
                    'is_rentable'                      => $asset->is_rentable,
                    'allow_bulk_quantity'              => $asset->allow_bulk_quantity,
                    'ownership_type'                   => $asset->ownership_type,
                    'ownership_company_id'             => $asset->ownership_company_id,
                    'ownership_supplier_id'            => $asset->ownership_supplier_id,
                    'ownership_customer_id'            => $asset->ownership_customer_id,
                    'custodian_id'                     => $asset->custodian_id,
                    'purchase_date'                    => $asset->purchase_date,
                    'available_for_use_date'           => $asset->available_for_use_date,
                    'net_purchase_amount'              => round(($asset->net_purchase_amount ?? 0) * $ratio, 2),
                    'gross_purchase_amount'            => round(($asset->gross_purchase_amount ?? 0) * $ratio, 2),
                    'additional_asset_cost'            => round(($asset->additional_asset_cost ?? 0) * $ratio, 2),
                    'purchase_receipt_id'              => $asset->purchase_receipt_id,
                    'purchase_invoice_id'              => $asset->purchase_invoice_id,
                    'purchase_receipt_item_id'         => $asset->purchase_receipt_item_id,
                    'purchase_invoice_item_id'         => $asset->purchase_invoice_item_id,
                    'calculate_depreciation'           => $asset->calculate_depreciation,
                    'is_depreciable'                   => $asset->is_depreciable,
                    'depreciation_method'              => $asset->depreciation_method,
                    'frequency_of_depreciation'        => $asset->frequency_of_depreciation,
                    'total_number_of_depreciations'    => $asset->total_number_of_depreciations,
                    'expected_value_after_useful_life' => round(($asset->expected_value_after_useful_life ?? 0) * $ratio, 2),
                    'salvage_value_percentage'         => $asset->salvage_value_percentage,
                    'rate_of_depreciation'             => $asset->rate_of_depreciation,
                    'daily_prorata_based'              => $asset->daily_prorata_based,
                    'maintenance_required'             => $asset->maintenance_required,
                    'insurance_policy_number'          => $asset->insurance_policy_number,
                    'insurance_insurer'                => $asset->insurance_insurer,
                    'insurance_insured_value'          => $asset->insurance_insured_value !== null ? round($asset->insurance_insured_value * $ratio, 2) : null,
                    'insurance_start_date'             => $asset->insurance_start_date,
                    'insurance_end_date'               => $asset->insurance_end_date,
                    'insurance_comprehensive'          => $asset->insurance_comprehensive,
                    'status'                           => [FormStatus::DRAFT],
                ]);

                $results->push($newAsset);
            }

            // Split adalah reparenting internal, bukan penghapusan data oleh user —
            // withoutEvents() skip Eloquent model events (termasuk guard canDelete()
            // milik LinkModel) secara eksplisit, tanpa bypass diam-diam lewat raw query.
            Asset::withoutEvents(function () use ($asset) {
                $asset->delete();
            });
        });

        return $results;
    }
}
