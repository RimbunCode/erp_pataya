<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use App\Models\Finances\FinanceSetting;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Masukan ubah mode engine per jenis dokumen (Finance Fase 2, Requirement 6.8, 8.3): `mode` off/shadow/on; memilih
 * `on` wajib disertai konfirmasi eksplisit (`confirmed` = true) karena menjadikan engine penulis jurnal.
 */
class PostingModeRequest extends FormRequest {
    use RejectsUnknownInput;

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'mode'      => ['required', 'string', Rule::in(FinanceSetting::POSTING_MODES)],
            'confirmed' => ['nullable', 'boolean', 'accepted_if:mode,' . FinanceSetting::POSTING_MODE_ON],
        ];
    }
}
