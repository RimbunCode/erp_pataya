<?php

namespace App\Http\Requests\Asset;

use App\Models\Asset\Asset;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssetRequest extends FormRequest {
    /**
     * FE (Form.jsx) mengirim item/custodian/ownership sebagai objek relasi utuh
     * ({id, ...}), bukan `_id` flat -- normalisasi ke `_id` di sini SEBELUM
     * validasi jalan, supaya rule `item_id` (required) dan validator custom
     * (validateItemIsFixedAsset/validatePurchaseLinkConsistency, keduanya baca
     * $this->input('item_id')) melihat nilai yang sebenarnya dikirim FE. Sama
     * pola dengan AssetService::flattenRelationFields(), hanya dijalankan lebih
     * awal (pre-validation, bukan pre-save). `ownership` (morph) -> `ownership_id`.
     */
    protected function prepareForValidation(): void {
        foreach (['item', 'custodian', 'ownership', 'ownership_customer_branch'] as $field) {
            $idKey = "{$field}_id";
            if (! $this->filled($idKey) && $this->filled("{$field}.id")) {
                $this->merge([$idKey => $this->input("{$field}.id")]);
            }
        }
    }

    public function rules(): array {
        return [
            'asset_name'                       => ['required', 'string', 'max:255'],
            'asset_category.id'                => ['required', 'string', 'exists:asset_categories,id'],
            'asset_category.*'                 => ['nullable'],
            'asset_location.id'                => ['required', 'string', 'exists:asset_locations,id'],
            'asset_location.*'                 => ['nullable'],
            'asset_type'                       => ['string', Rule::in(['existing_asset', 'composite_asset', 'composite_component'])],
            'item_id'                          => ['required', 'string', 'exists:items,id'],
            'purchase_receipt_id'              => ['nullable', 'string', 'exists:purchase_receipts,id'],
            'purchase_invoice_id'              => ['nullable', 'string', 'exists:purchase_invoices,id'],
            'purchase_receipt_item_id'         => ['nullable', 'string', 'exists:purchase_receipt_items,id'],
            'purchase_invoice_item_id'         => ['nullable', 'string', 'exists:purchase_invoice_items,id'],
            'asset_quantity'                   => ['integer', 'min:1'],
            'is_rentable'                      => ['boolean'],
            'allow_bulk_quantity'              => ['boolean'],
            'ownership_type'                   => ['string', Rule::in(['company', 'supplier', 'customer'])],
            'ownership_id'                     => ['nullable', 'string'],
            'ownership_customer_branch_id'     => ['nullable', 'string'],
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
            $this->validateItemIsFixedAsset($validator);
            $this->validatePurchaseLinkConsistency($validator);
        });
    }

    private function validateItemIsFixedAsset(Validator $validator): void {
        $itemId = $this->input('item_id');
        if (! $itemId) {
            return;
        }

        if (! Item::where('id', $itemId)->where('is_fixed_asset', true)->exists()) {
            $validator->errors()->add('item_id', __('asset/asset.item_must_be_fixed_asset'));
        }
    }

    /**
     * Consistency check untuk link manual Asset↔Purchase (spec
     * asset-management-purchase-integration-v2, Requirement 2 & 4): guard
     * idempoten server-side, kecocokan Item, kecocokan field derived, dan
     * kecocokan PurchaseOrderItem antara Receipt & Invoice bila keduanya diisi.
     */
    private function validatePurchaseLinkConsistency(Validator $validator): void {
        $currentAssetId = $this->route('asset')?->id;

        $receiptItem = $this->filled('purchase_receipt_item_id')
            ? PurchaseReceiptItem::with('item.item')->find($this->input('purchase_receipt_item_id'))
            : null;
        $invoiceItem = $this->filled('purchase_invoice_item_id')
            ? PurchaseInvoiceItem::with('item.item')->find($this->input('purchase_invoice_item_id'))
            : null;

        if ($receiptItem && Asset::where('purchase_receipt_item_id', $receiptItem->id)
            ->when($currentAssetId, fn ($q) => $q->where('id', '!=', $currentAssetId))
            ->exists()) {
            $validator->errors()->add('purchase_receipt_item_id', __('asset/asset.purchase_item_already_converted'));
        }
        if ($invoiceItem && Asset::where('purchase_invoice_item_id', $invoiceItem->id)
            ->when($currentAssetId, fn ($q) => $q->where('id', '!=', $currentAssetId))
            ->exists()) {
            $validator->errors()->add('purchase_invoice_item_id', __('asset/asset.purchase_item_already_converted'));
        }

        $itemId = $this->input('item_id');
        foreach (['purchase_receipt_item_id' => $receiptItem, 'purchase_invoice_item_id' => $invoiceItem] as $field => $row) {
            if ($row && $itemId && $row->item?->item?->id !== $itemId) {
                $validator->errors()->add($field, __('asset/asset.purchase_item_mismatch'));
            }
        }

        // asset_quantity/net_purchase_amount/gross_purchase_amount TIDAK
        // divalidasi terhadap nilai yang dikirim FE -- AssetService::create()/
        // update() meng-override langsung dari baris pembelian (server selalu
        // punya akses penuh ke model, tidak seperti FE yang bisa kena gate
        // `visibleFor` pada kolom rate/amount PurchaseInvoiceItem untuk user
        // tanpa akses Purchase, justru target utama fitur ini).

        if ($receiptItem && $invoiceItem) {
            $receiptPoItemId = $receiptItem->purchase_order_item_id;
            $invoicePoItemId = $invoiceItem->purchase_order_item_id;
            if (! $receiptPoItemId || ! $invoicePoItemId || $receiptPoItemId !== $invoicePoItemId) {
                $validator->errors()->add('purchase_invoice_item_id', __('asset/asset.purchase_receipt_invoice_mismatch'));
            }
        }
    }

    private function validateOwnershipExclusivity(Validator $validator): void {
        if (! $this->has('ownership_type')) {
            return;
        }

        $ownershipType = $this->input('ownership_type');

        // Model pemilik per tipe (company bukan model). Spec asset-ownership-morph Req 4.
        $modelByType = [
            'supplier' => Supplier::class,
            'customer' => Customer::class,
        ];

        if (! \in_array($ownershipType, ['company', ...\array_keys($modelByType)], true)) {
            return;
        }

        if ($ownershipType === 'company') {
            if ($this->filled('ownership_id')) {
                $validator->errors()->add('ownership', __('asset/asset.ownership_field_must_be_empty', ['field' => 'ownership']));
            }
        } else {
            $model = $modelByType[$ownershipType];
            if (! $this->filled('ownership_id')) {
                $validator->errors()->add('ownership', __('validation.required', ['attribute' => 'ownership']));
            } else {
                $thisModel = $this->input('ownership.thisModel');
                if ($thisModel !== null && $thisModel !== $model) {
                    $validator->errors()->add('ownership', __('asset/asset.ownership_model_mismatch', ['type' => $ownershipType]));
                } elseif (! $model::query()->whereKey($this->input('ownership_id'))->exists()) {
                    $validator->errors()->add('ownership', __('validation.exists', ['attribute' => 'ownership']));
                }
            }
        }

        // Cabang customer hanya relevan utk pemilik customer.
        if ($ownershipType !== 'customer' && $this->filled('ownership_customer_branch_id')) {
            $validator->errors()->add('ownership_customer_branch_id', __('asset/asset.ownership_field_must_be_empty', ['field' => 'ownership_customer_branch_id']));
        }
    }

    /**
     * Requirement 2.2, spec asset-category-simplification: allow_bulk_quantity
     * kini milik Asset sendiri (bukan AssetCategory) -- baca dari input request,
     * fallback ke record existing untuk update partial yang tidak mengirim
     * ulang field ini (pola sama dengan validatePurchaseLinkConsistency()).
     */
    private function validateRentableQuantity(Validator $validator): void {
        // Kalau link Receipt ada, quantity efektif adalah hasil override
        // AssetService::applyPurchaseLinkOverrides() (dari baris pembelian),
        // BUKAN nilai mentah yang dikirim FE -- FE tidak wajib bisa
        // menghitung nilai akurat sendiri (spec
        // asset-management-purchase-integration-v2, Requirement 3).
        $receiptItemId = $this->input('purchase_receipt_item_id');
        $quantity      = $receiptItemId
            ? (int) (PurchaseReceiptItem::find($receiptItemId)?->quantity ?? $this->input('asset_quantity', 1))
            : (int) $this->input('asset_quantity', 1);

        if ($quantity <= 1) {
            return;
        }

        $allowBulk = $this->has('allow_bulk_quantity')
            ? $this->boolean('allow_bulk_quantity')
            : (bool) $this->route('asset')?->allow_bulk_quantity;

        if (! $allowBulk) {
            $validator->errors()->add('asset_quantity', __('asset/asset.rentable_must_be_single_unit'));
        }
    }
}
