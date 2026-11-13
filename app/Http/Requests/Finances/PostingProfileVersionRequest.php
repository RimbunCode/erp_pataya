<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Masukan aksi "Buat versi baru" (salin) Posting Profile (Finance Fase 2, Requirement 2.4, 8.2): `effective_from`
 * wajib; kontinuitas dengan profil lama diputuskan `PostingProfileService::activate()`.
 */
class PostingProfileVersionRequest extends FormRequest {
    use RejectsUnknownInput;

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'effective_to'   => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            'name'           => ['nullable', 'string', 'max:255'],
        ];
    }
}
