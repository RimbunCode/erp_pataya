<?php

namespace App\Http\Requests\Asset;

use App\Http\Requests\BaseFormRequest;
use App\Models\Asset\Asset;
use Illuminate\Validation\Validator;

class CompleteAssetDataRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * FE mengirim object relasi utuh (asset_category/asset_location, hasil
     * LinkModel onValueChange) — bukan *_id string — konsisten pola AssetRequest
     * (Form.jsx Spec 1). Filter/transform ke *_id dilakukan di sini, satu titik,
     * supaya rules() dan service layer selalu bekerja dengan id string bersih.
     */
    protected function prepareForValidation(): void {
        $this->merge([
            'asset_category_id' => $this->input('asset_category.id'),
            'asset_location_id' => $this->input('asset_location.id'),
        ]);

        $rows = $this->input('rows');
        if (is_array($rows)) {
            $this->merge([
                'rows' => array_map(fn (array $row) => [
                    'asset_category_id' => data_get($row, 'asset_category.id'),
                    'asset_location_id' => data_get($row, 'asset_location.id'),
                    'quantity'          => data_get($row, 'quantity'),
                ], $rows),
            ]);
        }
    }

    public function rules(): array {
        $isSplit = $this->input('mode') === 'split';

        return [
            'mode'                     => ['required', 'in:single,split'],
            'source_document_type'     => ['required', 'in:purchase_receipt,purchase_invoice'],
            'source_document_id'       => ['required', 'string'],
            'asset_category_id'        => [$isSplit ? 'nullable' : 'required', 'string', 'exists:asset_categories,id'],
            'asset_location_id'        => [$isSplit ? 'nullable' : 'required', 'string', 'exists:asset_locations,id'],
            'rows'                     => [$isSplit ? 'required' : 'nullable', 'array', 'min:1'],
            'rows.*.asset_category_id' => ['required_with:rows', 'string', 'exists:asset_categories,id'],
            'rows.*.asset_location_id' => ['required_with:rows', 'string', 'exists:asset_locations,id'],
            'rows.*.quantity'          => ['required_with:rows', 'numeric', 'gt:0'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Asset $asset */
            $asset = $this->route('asset');
            $this->validateSourceDocument($validator, $asset);

            if ($this->input('mode') === 'split') {
                $this->validateSplitQuantity($validator, $asset);
            }
        });
    }

    /**
     * Requirement 6.6: dialog "Lengkapi Data Asset" hanya boleh dipakai untuk
     * Asset yang benar-benar berasal dari dokumen Purchase yang sedang dibuka
     * — mencegah user melengkapi Asset milik dokumen lain lewat manipulasi
     * request langsung ke endpoint (bypass UI, yang sudah men-scope daftar
     * Asset per dokumen lewat query fixedAssets di Controller).
     */
    private function validateSourceDocument(Validator $validator, Asset $asset): void {
        $type = $this->input('source_document_type');
        $id   = $this->input('source_document_id');

        $matches = match ($type) {
            'purchase_receipt' => $asset->purchase_receipt_id === $id,
            'purchase_invoice' => $asset->purchase_invoice_id === $id,
            default            => false,
        };

        if (! $matches) {
            $validator->errors()->add(
                'source_document_id',
                __('asset/asset.source_document_mismatch'),
            );
        }
    }

    private function validateSplitQuantity(Validator $validator, Asset $asset): void {
        $rows  = $this->input('rows', []);
        $total = array_sum(array_column($rows, 'quantity'));

        if (abs($total - (float) $asset->asset_quantity) > 0.0001) {
            $validator->errors()->add(
                'rows',
                __('asset/asset.split_quantity_mismatch', [
                    'total'    => $total,
                    'expected' => $asset->asset_quantity,
                ]),
            );
        }
    }
}
