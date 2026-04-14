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

        $branch = $this->resolveCurrentBranch();

        if ($branch) {
            $data['branch']    = $branch;
            $data['branch_id'] = $branch['id'];
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
