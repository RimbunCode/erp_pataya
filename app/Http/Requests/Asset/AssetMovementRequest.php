<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetMovementRequest extends FormRequest {
    public function rules(): array {
        return [
            'purpose'                    => ['required', 'string', 'in:issue,receipt,transfer,transfer_and_issue'],
            'transaction_date'           => ['required', 'date'],
            'branch_id'                  => ['nullable', 'string', 'exists:branches,id'],
            'reference_type'             => ['nullable', 'string'],
            'reference_id'               => ['nullable', 'string'],
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.asset_id'           => ['required', 'string', 'exists:assets,id'],
            'items.*.source_location_id' => ['nullable', 'string', 'exists:asset_locations,id'],
            'items.*.target_location_id' => ['nullable', 'string', 'exists:asset_locations,id'],
            'items.*.from_custodian_id'  => ['nullable', 'string', 'exists:users,id'],
            'items.*.to_custodian_id'    => ['nullable', 'string', 'exists:users,id'],
        ];
    }
}
