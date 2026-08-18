<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetServiceRequest extends FormRequest {
    public function rules(): array {
        $type = $this->input('type');

        return [
            'type'                           => ['required', 'string', 'in:maintenance_task,repair'],
            'branch_id'                      => ['nullable', 'string', 'exists:branches,id'],
            'description'                    => ['nullable', 'string'],
            'asset_id'                       => [$type === 'repair' ? 'required' : 'prohibited', 'string', 'exists:assets,id'],
            'asset_maintenance_task_id'      => [$type === 'maintenance_task' ? 'required' : 'prohibited', 'string', 'exists:asset_maintenance_tasks,id'],
            'failure_date'                   => [$type === 'repair' ? 'required' : 'prohibited', 'date'],
            'capitalize_repair_cost'         => ['nullable', 'boolean'],
            'increase_in_asset_life'         => ['nullable', 'integer'],
            'consumedItems'                  => ['nullable', 'array'],
            'consumedItems.*.item.id'        => ['required_with:consumedItems', 'string', 'exists:items,id'],
            'consumedItems.*.unit.id'        => ['required_with:consumedItems', 'string', 'exists:item_units,id'],
            'consumedItems.*.quantity'       => ['required_with:consumedItems', 'numeric', 'min:0'],
            'consumedItems.*.valuation_rate' => ['required_with:consumedItems', 'numeric', 'min:0'],
        ];
    }
}
