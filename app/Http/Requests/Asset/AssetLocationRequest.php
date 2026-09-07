<?php

namespace App\Http\Requests\Asset;

use App\Rules\UserHasBranchAccess;
use Illuminate\Foundation\Http\FormRequest;

class AssetLocationRequest extends FormRequest {
    /**
     * Frontend mengirim relasi (branch, parent) sebagai objek LinkModel utuh
     * ({id, ...}), bukan string id flat. Ekstrak `.id` ke key `_id` yang
     * dikonsumsi rules()/validated() di bawah sebelum langsung dipakai
     * AssetLocationController::store()/update() (tanpa Service perantara).
     */
    protected function prepareForValidation(): void {
        if (isset($this->branch['id'])) {
            $this->merge(['branch_id' => $this->branch['id']]);
        }
        if (isset($this->parent['id'])) {
            $this->merge(['parent_id' => $this->parent['id']]);
        }
    }

    public function rules(): array {
        return [
            'location_name' => ['required', 'string', 'max:255'],
            'parent_id'     => ['nullable', 'string', 'exists:asset_locations,id'],
            'is_group'      => ['boolean'],
            'branch_id'     => ['required', 'string', 'exists:branches,id', new UserHasBranchAccess],
        ];
    }
}
