<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetValueAdjustmentRequest extends FormRequest {
    public function rules(): array {
        return [
            'asset.id'              => ['required', 'string', 'exists:assets,id'],
            'asset.*'               => ['nullable'],
            'date'                  => ['required', 'date'],
            'new_asset_value'       => ['required', 'numeric', 'min:0'],
            'difference_account.id' => ['required', 'string', 'exists:accounts,id'],
            'difference_account.*'  => ['nullable'],
            'branch_id'             => ['nullable', 'string', 'exists:branches,id'],
        ];
    }
}
