<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Services\Core\FilterTreeCleaner;
use App\Traits\DataTable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\ValidationException;

class StoreSavedFilterRequest extends BaseFormRequest {
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
            'name'   => ['nullable', 'string', 'max:255'],
            // fid opsional: id filter ephemeral aktif untuk di-update (bukan
            // membuat row baru) saat user memperbarui filternya sendiri.
            'fid' => ['nullable', 'string'],
        ];
    }

    /**
     * Setelah rules dasar lolos: bersihkan filter tree (drop item invalid,
     * collapse grup kosong) lalu pastikan masih ada filter valid. Tree bersih
     * disimpan kembali agar controller menyimpan versi yang sudah dibersihkan.
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
     * Model harus class valid yang memakai trait DataTable (model yang dapat difilter).
     */
    private function validModelRule(): \Closure {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! is_string($value) || ! class_exists($value)) {
                $fail('Model tidak valid.');

                return;
            }
            if (! in_array(DataTable::class, class_uses_recursive($value), true)) {
                $fail('Model tidak mendukung filter.');
            }
        };
    }
}
