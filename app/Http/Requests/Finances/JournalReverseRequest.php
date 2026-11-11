<?php

namespace App\Http\Requests\Finances;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Masukan aksi Balik (reverse) jurnal (Finance Fase 1, Requirement 5.1, 11.2). Hanya tanggal dan alasan; izin
 * `reverse` ditegakkan oleh `JournalController`. Sengaja bukan `BaseFormRequest` karena jurnal tidak diberi
 * `branch_id` dari sesi.
 */
class JournalReverseRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'date'   => ['nullable', 'date_format:Y-m-d'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
