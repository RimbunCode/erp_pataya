<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Models\User\Permission;
use Illuminate\Contracts\Validation\ValidationRule;

class PreviewFilterTemplateRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'model'  => ['required', 'string', $this->registeredModelRule()],
            'filter' => ['nullable', 'array'],
            'sort'   => ['nullable', 'string', 'regex:/^-?[a-zA-Z0-9_.]+$/'],
        ];
    }

    /**
     * Model harus terdaftar di registry Permission (sumber kebenaran "model
     * mana yang bisa dipilih" — sama seperti PermissionLinkModel picker di
     * form) — mencegah probing FQCN arbitrary lewat endpoint preview.
     */
    private function registeredModelRule(): \Closure {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! is_string($value) || ! class_exists($value)) {
                $fail('Model tidak valid.');

                return;
            }
            if (! Permission::where('model', $value)->exists()) {
                $fail('Model tidak terdaftar.');
            }
        };
    }
}
