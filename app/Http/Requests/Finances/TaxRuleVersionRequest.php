<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use App\Models\Finances\TaxRuleVersion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Masukan buat/ubah versi aturan pajak `draft` (Finance Fase 3, Requirement 2.1). Hanya atribut yang dirancang
 * untuk diisi pengguna yang diterima; `tax_id`, `version`, `status`, dan `created_by_id` ditentukan service/route
 * dan input lain ditolak. Tumpang-tindih, guard faktor DPP, dan batas nilai lain diputuskan
 * `TaxRuleVersionService` (pesannya diteruskan sebagai galat validasi oleh controller).
 *
 * Bukan `BaseFormRequest`: `branch`/`branch_id` tidak dikenal service versi aturan.
 */
class TaxRuleVersionRequest extends FormRequest {
    use RejectsUnknownInput;

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'effective_from'  => ['required', 'date_format:Y-m-d'],
            'effective_to'    => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            'rate'            => ['required', 'numeric', 'min:0', 'max:100'],
            'dpp_numerator'   => ['required', 'integer', 'min:1', 'max:65535'],
            'dpp_denominator' => ['required', 'integer', 'min:1', 'max:65535'],
            'rounding_mode'   => ['required', 'string', Rule::in(TaxRuleVersion::ROUNDING_MODES)],
            'output_role'     => ['required', 'string', 'max:64', 'regex:/^[a-z][a-z0-9_]*$/'],
            'input_role'      => ['required', 'string', 'max:64', 'regex:/^[a-z][a-z0-9_]*$/'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Atribut siap diberikan ke `TaxRuleVersionService` (hanya kunci tervalidasi).
     *
     * @return array<string, mixed>
     */
    public function attributesForService(): array {
        return $this->validated();
    }
}
