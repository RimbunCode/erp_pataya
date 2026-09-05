<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Models\User\Permission;
use App\Services\Core\FilterTreeCleaner;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\ValidationException;

class StoreFilterTemplateRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'model'  => ['required', 'string', $this->validModelRule()],
            'filter' => ['required', 'array'],
            'name'   => ['required', 'string', 'max:255'],
            'sort'   => ['nullable', 'string', 'regex:/^-?[a-zA-Z0-9_.]+$/'],
        ];
    }

    /**
     * Bersihkan filter tree (drop item invalid, collapse grup kosong) lalu
     * pastikan masih ada item valid — mirror StoreSavedFilterRequest.
     */
    protected function passedValidation(): void {
        /** @var class-string $modelClass */
        $modelClass = $this->input('model');
        $columns    = $modelClass::getColumns(1);

        $cleaner = new FilterTreeCleaner($columns);
        $cleaned = $cleaner->clean((array) $this->input('filter'));

        if (! $cleaner->hasValidItems($cleaned)) {
            throw ValidationException::withMessages([
                'filter' => __('core.datatable.filter.validation.empty_tree'),
            ]);
        }

        $this->merge(['filter' => $cleaned]);
    }

    /**
     * Model harus terdaftar di registry Permission (sama seperti sumber
     * PermissionLinkModel picker di form) — konsisten dengan validasi preview.
     */
    private function validModelRule(): \Closure {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! is_string($value) || ! class_exists($value)) {
                $fail('Model tidak valid.');

                return;
            }
            if (! Permission::where('model', $value)->exists()) {
                $fail('Model tidak mendukung filter.');
            }
        };
    }
}
