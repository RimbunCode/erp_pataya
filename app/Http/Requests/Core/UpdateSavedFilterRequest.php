<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Models\Core\SavedFilter;
use App\Services\Core\FilterTreeCleaner;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\ValidationException;

class UpdateSavedFilterRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            // name & filter sama-sama opsional: promote-with-name, rename, atau
            // overwrite tree (timpa filter named existing) — minimal salah satu.
            'name'   => ['nullable', 'string', 'max:255'],
            'filter' => ['nullable', 'array'],
        ];
    }

    /**
     * Bila `filter` dikirim (overwrite tree), bersihkan terhadap kolom model
     * milik saved filter ini lalu pastikan masih ada item valid. Tree bersih
     * disimpan kembali agar controller menyimpan versi yang sudah dibersihkan.
     */
    protected function passedValidation(): void {
        if (! $this->has('filter')) {
            return;
        }

        /** @var SavedFilter $savedFilter */
        $savedFilter = $this->route('savedFilter');
        /** @var class-string $modelClass */
        $modelClass = $savedFilter->model;

        $cleaner = new FilterTreeCleaner($modelClass::getColumns(1));
        $cleaned = $cleaner->clean((array) $this->input('filter'));

        if (! $cleaner->hasValidItems($cleaned)) {
            throw ValidationException::withMessages([
                'filter' => __('core.datatable.filter.validation.empty_tree'),
            ]);
        }

        $this->merge(['filter' => $cleaned]);
    }
}
