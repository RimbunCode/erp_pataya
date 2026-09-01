<?php

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssetServiceRequest extends FormRequest {
    public function rules(): array {
        $type = $this->input('type');

        return [
            'type'                      => ['required', 'string', 'in:maintenance_task,repair'],
            'branch_id'                 => ['nullable', 'string', 'exists:branches,id'],
            'description'               => ['nullable', 'string'],
            'asset.id'                  => [$type === 'repair' ? 'required' : 'prohibited', 'string', 'exists:assets,id'],
            'asset.*'                   => ['nullable'],
            'asset_maintenance_task_id' => [$type === 'maintenance_task' ? 'required' : 'prohibited', 'string', 'exists:asset_maintenance_tasks,id'],
            'failure_date'              => [$type === 'repair' ? 'required' : 'prohibited', 'date'],
            'capitalize_repair_cost'    => ['nullable', 'boolean'],
            'increase_in_asset_life'    => ['nullable', 'integer'],
            'consumedItems'             => ['nullable', 'array'],
            // Requirement 4.5, spec asset-service-billing: item.id sekarang
            // ItemVariant (bukan Item langsung) — selaras SalesOrderItem/
            // InternalOrderItem.item_id, supaya bisa auto-derive 1:1 tanpa ambigu.
            'consumedItems.*.item.id'        => ['required_with:consumedItems', 'string', 'exists:item_variants,id'],
            'consumedItems.*.unit.id'        => ['required_with:consumedItems', 'string', 'exists:item_units,id'],
            'consumedItems.*.quantity'       => ['required_with:consumedItems', 'numeric', 'min:0'],
            'consumedItems.*.valuation_rate' => ['required_with:consumedItems', 'numeric', 'min:0'],
        ];
    }
}
