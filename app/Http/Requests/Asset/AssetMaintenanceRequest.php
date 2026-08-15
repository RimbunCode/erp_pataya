<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetMaintenanceRequest extends FormRequest {
    public function rules(): array {
        return [
            'asset_id'                     => ['required', 'string', 'exists:assets,id'],
            'maintenance_team_id'          => ['nullable', 'string', 'exists:asset_maintenance_teams,id'],
            'tasks'                        => ['nullable', 'array'],
            'tasks.*.task_name'            => ['required_with:tasks', 'string'],
            'tasks.*.maintenance_type'     => ['required_with:tasks', 'string'],
            'tasks.*.periodicity'          => ['required_with:tasks', 'integer', 'min:1'],
            'tasks.*.next_due_date'        => ['required_with:tasks', 'date'],
            'tasks.*.assign_to_id'         => ['nullable', 'string', 'exists:users,id'],
            'tasks.*.certificate_required' => ['nullable', 'boolean'],
            'tasks.*.description'          => ['nullable', 'string'],
        ];
    }
}
