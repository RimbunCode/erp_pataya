<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetLocationRequest extends FormRequest {
    public function rules(): array {
        return [
            'location_name' => ['required', 'string', 'max:255'],
            'parent_id'     => ['nullable', 'string', 'exists:asset_locations,id'],
            'is_group'      => ['boolean'],
            'branch_id'     => ['required', 'string', 'exists:branches,id'],
        ];
    }
}
