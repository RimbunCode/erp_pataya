<?php

namespace App\Http\Requests\Asset;

use App\Http\Requests\BaseFormRequest;

class AssetServiceRequest extends BaseFormRequest {
    public function rules(): array {
        $type = $this->input('type');

        return [
            'type' => ['required', 'string', 'in:maintenance_task,repair'],
            // Requirement (bug fix): tidak ada field UI branch di Form.jsx
            // (rule branch_id lama vestigial dari scaffolding awal, sudah
            // dihapus) -- JANGAN deklarasi rule branch_id sendiri di sini,
            // biar BaseFormRequest::validated() auto-inject branch aktif
            // session (sama seperti WorkOrder/SalesOrder/PurchaseOrder).
            // Deklarasi sendiri di sini bikin auto-inject di-skip (lihat
            // komentar BaseFormRequest).
            'description' => ['nullable', 'string'],
            // 'nullable' wajib disertakan di samping required/prohibited kondisional --
            // Inertia useForm() selalu mengirim SELURUH key `data` (termasuk yang
            // bernilai null untuk cabang type yang sedang tidak aktif), tanpa
            // 'nullable' rule format (string/date/exists) tetap dievaluasi thd
            // null dan gagal "must be a string"/"must be a date" walau field
            // memang seharusnya kosong untuk type tsb.
            'asset.id'                  => [$type === 'repair' ? 'required' : 'prohibited', 'nullable', 'string', 'exists:assets,id'],
            'asset.*'                   => ['nullable'],
            'asset_maintenance_task_id' => [$type === 'maintenance_task' ? 'required' : 'prohibited', 'nullable', 'string', 'exists:asset_maintenance_tasks,id'],
            'failure_date'              => [$type === 'repair' ? 'required' : 'prohibited', 'nullable', 'date'],
            'capitalize_repair_cost'    => ['nullable', 'boolean'],
            'increase_in_asset_life'    => ['nullable', 'integer'],
            'consumedItems'             => ['nullable', 'array'],
            // Requirement 4.5, spec asset-service-billing: item.id sekarang
            // ItemVariant (bukan Item langsung) — selaras SalesOrderItem/
            // InternalOrderItem.item_id, supaya bisa auto-derive 1:1 tanpa ambigu.
            'consumedItems.*.item.id'  => ['required_with:consumedItems', 'string', 'exists:item_variants,id'],
            'consumedItems.*.unit.id'  => ['required_with:consumedItems', 'string', 'exists:item_units,id'],
            'consumedItems.*.quantity' => ['required_with:consumedItems', 'numeric', 'min:0'],
        ];
    }
}
