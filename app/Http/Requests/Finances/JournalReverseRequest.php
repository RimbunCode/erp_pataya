<?php

namespace App\Http\Requests\Finances;

use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Masukan aksi Balik (reverse) jurnal (Finance Fase 1, Requirement 5.1, 11.2). Hanya tanggal (opsional, dibatasi) dan alasan (wajib); izin
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
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }

    /**
     * Batas tanggal pembalikan (diputuskan pemilik produk 2026-11-12): tidak boleh sebelum tanggal jurnal asal dan
     * tidak boleh di masa depan, keduanya sebagai hari dalam zona waktu perusahaan (Requirement 6.9).
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array {
        return [
            function (Validator $validator): void {
                $journal = $this->route('journal');
                $date    = $this->input('date');
                if (! $journal instanceof Journal || ! \is_string($date) || $validator->errors()->has('date')) {
                    return;
                }

                $timezone = app(FiscalPeriodService::class)->companyTimezone();
                $original = CarbonImmutable::parse($journal->transaction_date)->setTimezone($timezone)->toDateString();
                $today    = CarbonImmutable::now($timezone)->toDateString();

                if ($date < $original) {
                    $validator->errors()->add('date', __('finances/journal.reverse.errors.before_journal', ['date' => $original]));
                } elseif ($date > $today) {
                    $validator->errors()->add('date', __('finances/journal.reverse.errors.in_future'));
                }
            },
        ];
    }
}
