<?php

namespace App\Http\Requests\Core;

/**
 * Untuk FormRequest yang menerima `group` (UpdateSavedFilterRequest,
 * StoreFilterTemplateRequest, UpdateFilterTemplateRequest). Klien basi
 * pasca-deploy (tab yang belum reload) masih mengirim bentuk lama: SATU
 * objek `{column, granularity, range}`. Dibungkus jadi list 1 level SEBELUM
 * validasi supaya diterima, bukan 422 (spec datatable2-group-tree,
 * Requirement 3.4 & 18.3).
 *
 * Sengaja HANYA membungkus -- tidak membuang elemen tak valid: aturan
 * `SavedFilter::groupValidationRules()` tetap harus bisa menolak level tanpa
 * `column` / granularity salah dengan 422 (objek lama tanpa `column` jadi
 * `group.0.column`).
 */
trait NormalizesGroupInput {
    protected function prepareForValidation(): void {
        $group = $this->input('group');

        if ($this->has('group') && \is_array($group) && ! \array_is_list($group)) {
            $this->merge(['group' => [$group]]);
        }
    }
}
