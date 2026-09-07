<?php

namespace App\Http\Requests;

use App\Models\Core\Branch;
use Illuminate\Foundation\Http\FormRequest;

abstract class BaseFormRequest extends FormRequest {
    /**
     * Get validated data from the request.
     *
     * @param  array<string>|int|string|null  $key
     * @param  mixed  $default
     */
    public function validated($key = null, $default = null): mixed {
        $data = parent::validated();

        // Auto-tag branch_id dengan branch aktif HANYA kalau Request ini sendiri
        // tidak punya rule branch/branch_id (mis. StockEntryRequest yang tidak
        // pernah minta user pilih branch secara eksplisit). Kalau Request punya
        // rule branch.id/branch_id sendiri (mis. WarehouseRequest), nilai yang
        // sudah divalidasi+dicek akses (App\Rules\UserHasBranchAccess) itu yang
        // dipakai — jangan ditimpa diam-diam oleh branch session, karena itu
        // bikin pilihan Branch di form jadi percuma (selalu balik ke branch aktif).
        if (! array_key_exists('branch', $data) && ! array_key_exists('branch_id', $data)) {
            $branch = $this->resolveCurrentBranch();

            if ($branch) {
                $data['branch']    = $branch;
                $data['branch_id'] = $branch['id'];
            }
        }

        if ($key !== null) {
            return data_get($data, $key, $default);
        }

        return $data;
    }

    protected function resolveCurrentBranch() {
        $branchId = session('currentBranch');

        if (\is_int($branchId) || \is_string($branchId)) {
            return Branch::find($branchId)?->toArray();
        }

        return null;
    }
}
