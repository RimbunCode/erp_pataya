<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetServiceActivityRequest extends FormRequest {
    public function rules(): array {
        return [
            'action_date' => ['required', 'date'],
            'pic_id'      => ['nullable', 'string', 'exists:users,id'],
            'description' => ['required', 'string'],
            'is_done'     => ['nullable', 'boolean'],
        ];
    }
}
