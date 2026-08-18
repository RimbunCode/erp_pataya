<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetCategoryRequest extends FormRequest {
    public function rules(): array {
        return [
            'category_name'                         => ['required', 'string', 'max:255'],
            'non_depreciable_category'              => ['boolean'],
            'enable_cwip_accounting'                => ['boolean'],
            'is_rentable'                           => ['boolean'],
            'allow_bulk_quantity'                   => ['boolean'],
            'default_depreciation_method'           => ['nullable', 'string'],
            'default_frequency_of_depreciation'     => ['nullable', 'integer'],
            'default_total_number_of_depreciations' => ['nullable', 'integer'],
        ];
    }
}
