<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetValueAdjustmentRequest extends FormRequest {
    public function rules(): array {
        return [
            'asset_id'              => ['required', 'string', 'exists:assets,id'],
            'date'                  => ['required', 'date'],
            'new_asset_value'       => ['required', 'numeric', 'min:0'],
            'difference_account_id' => ['required', 'string', 'exists:accounts,id'],
            'branch_id'             => ['nullable', 'string', 'exists:branches,id'],
        ];
    }
}
