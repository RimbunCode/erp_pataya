<?php

namespace App\Http\Requests\Finances;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Masukan aksi Generate tahun fiskal kalender (Finance Fase 1, Requirement 6.3, 11.4). Rentang tahun sama dengan
 * `finance:generate-fiscal-year`.
 */
class FiscalYearGenerateRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'year' => ['required', 'integer', 'between:1900,2200'],
        ];
    }
}
