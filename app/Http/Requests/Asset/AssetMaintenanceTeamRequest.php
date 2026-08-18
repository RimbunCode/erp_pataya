<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetMaintenanceTeamRequest extends FormRequest {
    public function rules(): array {
        return [
            'team_name'         => ['required', 'string'],
            'manager_id'        => ['nullable', 'string', 'exists:users,id'],
            'branch_id'         => ['nullable', 'string', 'exists:branches,id'],
            'members'           => ['nullable', 'array'],
            'members.*.user_id' => ['required_with:members', 'string', 'exists:users,id'],
        ];
    }
}
