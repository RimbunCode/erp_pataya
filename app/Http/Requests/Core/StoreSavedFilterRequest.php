<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Traits\DataTable;
use Illuminate\Contracts\Validation\ValidationRule;

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
        ];
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
