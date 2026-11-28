<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use App\Services\Finances\Currency\Providers\CsvImportProvider;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Impor kurs CSV (Finance Fase 4, Requirement 1.4-1.5): hanya satu berkas unggahan `file`, tanpa path dari input.
 * Ukuran dibatasi `CsvImportProvider::MAX_BYTES`; isi diperiksa per baris oleh penyedia.
 */
class ExchangeRateImportRequest extends FormRequest {
    use RejectsUnknownInput;

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'file' => ['required', 'file', 'extensions:csv,txt', 'max:' . (CsvImportProvider::MAX_BYTES / 1024)],
        ];
    }
}
