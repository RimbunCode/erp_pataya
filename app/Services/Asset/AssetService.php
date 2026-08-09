<?php

namespace App\Services\Asset;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Core\FormatingSeries;
use App\Models\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

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
        return Asset::create([
            'code' => FormatingSeries::generate(Asset::class, $data, true),
            ...Arr::only($data, [
                'asset_name', 'asset_category_id', 'asset_location_id',
                'asset_type', 'item_id', 'asset_quantity',
                'ownership_type', 'ownership_company_id',
                'ownership_supplier_id', 'ownership_customer_id',
                'custodian_id',
                'purchase_date', 'available_for_use_date',
                'net_purchase_amount', 'gross_purchase_amount',
                'additional_asset_cost',
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
            $model->fill(Arr::only($data, [
                'asset_name', 'asset_category_id', 'asset_location_id',
                'item_id', 'asset_quantity',
                'ownership_type', 'ownership_company_id',
                'ownership_supplier_id', 'ownership_customer_id',
                'custodian_id',
                'purchase_date', 'available_for_use_date',
                'net_purchase_amount', 'gross_purchase_amount',
                'additional_asset_cost',
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

    public function submit(Model $model): mixed {
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
        throw new \LogicException(__('asset/asset.cannot_cancel'));
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

        return null;
    }

    public function onRejected(Model $model): mixed {
        // Kembalikan ke Draft
        $model->update([
            'status' => [FormStatus::DRAFT],
        ]);

        return null;
    }
}
