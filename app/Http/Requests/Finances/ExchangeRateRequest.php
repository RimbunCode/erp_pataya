<?php

namespace App\Http\Requests\Finances;

use App\Enums\RateType;
use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Masukan kurs manual (Finance Fase 4, Requirement 1.2, 1.5). Hanya bentuk masukan yang diperiksa di sini; aturan domain
 * (mata uang ada, `from != to`, `rate > 0` dengan paling banyak 8 digit desimal, tanggal kalender) diputuskan
 * `ExchangeRateRecorder` dan diteruskan controller sebagai galat validasi per kolom. Koreksi (`exchangeRates.correct`)
 * hanya menerima `rate`: pasangan, tipe, dan tanggal berasal dari baris pada URL.
 *
 * Bukan `BaseFormRequest`: kurs bersifat global (tanpa cabang).
 */
class ExchangeRateRequest extends FormRequest {
    use RejectsUnknownInput;

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        $rate = ['required', 'string', 'max:40'];

        if ($this->routeIs('exchangeRates.correct')) {
            return ['rate' => $rate];
        }

        return [
            'from_currency_code' => ['required', 'string', 'max:10'],
            'to_currency_code'   => ['required', 'string', 'max:10'],
            'rate_type'          => ['required', 'string', Rule::in(RateType::values())],
            'rate'               => $rate,
            'rate_date'          => ['required', 'string', 'max:10'],
        ];
    }
}
