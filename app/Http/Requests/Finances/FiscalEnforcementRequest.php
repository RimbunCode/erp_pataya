<?php

namespace App\Http\Requests\Finances;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Masukan toggle penegakan periode fiskal (`enforce_fiscal_period`, Finance Fase 1, Requirement 6.4, 11.5). Hanya
 * satu kunci; izin `write` pada `FinanceSetting` ditegakkan oleh `FiscalPeriodController`.
 */
class FiscalEnforcementRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'enforce_fiscal_period' => ['required', 'boolean'],
        ];
    }
}
