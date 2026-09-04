<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Models\Core\SavedFilter;
use App\Services\Core\FilterTreeCleaner;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\ValidationException;

class UpdateFilterTemplateRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'name'   => ['nullable', 'string', 'max:255'],
            'filter' => ['nullable', 'array'],
            'sort'   => ['nullable', 'string', 'regex:/^-?[a-zA-Z0-9_.]+$/'],
        ];
    }

    /**
     * Bila `filter` dikirim (overwrite tree), bersihkan terhadap kolom model
     * milik shared filter ini lalu pastikan masih ada item valid.
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
