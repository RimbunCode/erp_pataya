<?php

namespace App\Http\Requests\Asset;

use App\Models\Asset\AssetCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssetRequest extends FormRequest {
    public function rules(): array {
        return [
            'asset_name'                       => ['required', 'string', 'max:255'],
            'asset_category.id'                => ['required', 'string', 'exists:asset_categories,id'],
            'asset_category.*'                 => ['nullable'],
            'asset_location.id'                => ['required', 'string', 'exists:asset_locations,id'],
            'asset_location.*'                 => ['nullable'],
            'asset_type'                       => ['string', Rule::in(['existing_asset', 'composite_asset', 'composite_component'])],
            'item_id'                          => ['nullable', 'string', 'exists:items,id'],
            'asset_quantity'                   => ['integer', 'min:1'],
            'ownership_type'                   => ['string', Rule::in(['company', 'supplier', 'customer'])],
            'ownership_company_id'             => ['nullable', 'string'],
            'ownership_supplier_id'            => ['nullable', 'string'],
            'ownership_customer_id'            => ['nullable', 'string'],
            'custodian_id'                     => ['nullable', 'string', 'exists:users,id'],
            'purchase_date'                    => ['nullable', 'date'],
            'available_for_use_date'           => ['nullable', 'date'],
            'net_purchase_amount'              => ['numeric', 'min:0'],
            'gross_purchase_amount'            => ['numeric', 'min:0'],
            'additional_asset_cost'            => ['numeric', 'min:0'],
            'calculate_depreciation'           => ['boolean'],
            'is_depreciable'                   => ['nullable', 'boolean'],
            'depreciation_method'              => ['nullable', 'string'],
            'frequency_of_depreciation'        => ['nullable', 'integer'],
            'total_number_of_depreciations'    => ['nullable', 'integer'],
            'next_depreciation_date'           => ['nullable', 'date'],
            'expected_value_after_useful_life' => ['nullable', 'numeric'],
            'salvage_value_percentage'         => ['nullable', 'numeric'],
            'rate_of_depreciation'             => ['nullable', 'numeric'],
            'daily_prorata_based'              => ['boolean'],
            'maintenance_required'             => ['boolean'],
            'insurance_policy_number'          => ['nullable', 'string'],
            'insurance_insurer'                => ['nullable', 'string'],
            'insurance_insured_value'          => ['nullable', 'numeric'],
            'insurance_start_date'             => ['nullable', 'date'],
            'insurance_end_date'               => ['nullable', 'date'],
            'insurance_comprehensive'          => ['nullable', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateOwnershipExclusivity($validator);
            $this->validateRentableQuantity($validator);
        });
    }

    private function validateOwnershipExclusivity(Validator $validator): void {
        if (! $this->has('ownership_type')) {
            return;
        }

        $ownershipType = $this->input('ownership_type');

        $fieldByType = [
            'company'  => 'ownership_company_id',
            'supplier' => 'ownership_supplier_id',
            'customer' => 'ownership_customer_id',
        ];

        if (! isset($fieldByType[$ownershipType])) {
            return;
        }

        $requiredField = $fieldByType[$ownershipType];
        if ($ownershipType !== 'company' && ! $this->filled($requiredField)) {
            $validator->errors()->add($requiredField, __('validation.required', ['attribute' => $requiredField]));
        }

        foreach ($fieldByType as $type => $field) {
            if ($type !== $ownershipType && $this->filled($field)) {
                $validator->errors()->add($field, __('asset/asset.ownership_field_must_be_empty', ['field' => $field]));
            }
        }
    }

    private function validateRentableQuantity(Validator $validator): void {
        $categoryId = $this->input('asset_category.id');
        $quantity   = (int) $this->input('asset_quantity', 1);

        if (! $categoryId || $quantity <= 1) {
            return;
        }

        $category = AssetCategory::find($categoryId);
        if ($category && $category->is_rentable) {
            $validator->errors()->add('asset_quantity', __('asset/asset.rentable_must_be_single_unit'));
        }
    }
}
