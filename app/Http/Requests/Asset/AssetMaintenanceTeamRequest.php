<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetMaintenanceTeamRequest extends FormRequest {
    public function rules(): array {
        return [
            'team_name'         => ['required', 'string'],
            'manager.id'        => ['nullable', 'string', 'exists:users,id'],
            'manager.*'         => ['nullable'],
            'branch.id'         => ['nullable', 'string', 'exists:branches,id'],
            'branch.*'          => ['nullable'],
            'members'           => ['nullable', 'array'],
            'members.*.user.id' => ['required_with:members', 'string', 'exists:users,id'],
            'members.*.user.*'  => ['nullable'],
        ];
    }
}
