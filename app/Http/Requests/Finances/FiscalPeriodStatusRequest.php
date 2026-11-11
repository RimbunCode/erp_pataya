<?php

namespace App\Http\Requests\Finances;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Masukan aksi buka/tutup periode fiskal (Finance Fase 1, Requirement 6.7, 14.2): alasan opsional yang dicatat di
 * log audit (`data_after.reason`).
 */
class FiscalPeriodStatusRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
