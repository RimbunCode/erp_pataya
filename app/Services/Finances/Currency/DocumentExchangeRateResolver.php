<?php

namespace App\Services\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\NoExchangeRateException;
use App\Models\Finances\ExchangeRate;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Menentukan kurs dan jejak kurs sebuah dokumen (Sales Invoice, Purchase Invoice, Payment Entry) dari `FxEngine`
 * (Finance Fase 4, Requirement 3.2 dan 3.5). Tipe kurs default `transaction` (D-16).
 *
 * Hasil (`array`) langsung dapat digabung ke atribut dokumen:
 * - `exchange_rate`: nilai dasar per 1 unit mata uang dokumen. Untuk kurs kebalikan (baris tersimpan `dasar -> dokumen`)
 *   nilainya `1/kurs tersimpan` pada 8 digit (`FxConversion::$rate`); jejaknya (`exchange_rate_id` menunjuk baris
 *   kebalikan, arahnya terbaca dari `from_currency_code`/`to_currency_code` baris itu).
 * - `exchange_rate_id/type/date/source`: jejak. Seluruhnya null untuk dokumen mata uang dasar.
 *
 * Kurs ketikan pengguna: sama dengan kurs master -> jejak master; berbeda, atau master tidak ada -> diterima apa adanya
 * dengan jejak `source = manual_input` dan `exchange_rate_id` null (belum merujuk kurs master). Pembatasan override ke
 * pengguna ber-izin dengan alasan tercatat (Requirement 3.5) belum diterapkan: spek tidak menamai izin maupun kolom
 * alasan (pertanyaan terbuka di `tasks.md` Task 4).
 */
final class DocumentExchangeRateResolver {
    public const SOURCE_MANUAL_INPUT = 'manual_input';

    public function __construct(private readonly FxEngine $fx) {}

    /**
     * @return array{exchange_rate: string|int, exchange_rate_id: ?string, exchange_rate_type: ?string, exchange_rate_date: ?string, exchange_rate_source: ?string}
     *
     * @throws ValidationException bila mata uang asing, tanpa kurs ketikan, dan master kurs tidak ada
     */
    public function resolve(?string $currencyCode, mixed $date, mixed $typedRate): array {
        $base = $this->fx->baseCurrency();

        if ($base === null && $currencyCode !== null && $currencyCode !== '') {
            // Mata uang dasar belum diatur: perilaku lama (kurs ketikan wajib, tanpa jejak), tidak ada dasar konversi.
            $typed = $this->typed($typedRate);
            if ($typed === null) {
                throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
            }

            return ['exchange_rate' => $typed, 'exchange_rate_id' => null, 'exchange_rate_type' => null, 'exchange_rate_date' => null, 'exchange_rate_source' => null];
        }

        if ($currencyCode === null || $currencyCode === '' || $currencyCode === $base) {
            return ['exchange_rate' => 1, 'exchange_rate_id' => null, 'exchange_rate_type' => null, 'exchange_rate_date' => null, 'exchange_rate_source' => null];
        }

        $day = Carbon::parse($date ?? 'now')->startOfDay();

        try {
            $conversion = $this->fx->convert('1', $currencyCode, $base, $day, RateType::Transaction);
        } catch (NoExchangeRateException $e) {
            $conversion = null;
            $missing    = $e;
        }

        $typed = $this->typed($typedRate);

        if ($conversion !== null && ($typed === null || Decimal::compare($typed, $conversion->rate) === 0)) {
            $this->lockRate($conversion->exchangeRateId);

            return [
                'exchange_rate'        => $conversion->rate,
                'exchange_rate_id'     => $conversion->exchangeRateId,
                'exchange_rate_type'   => $conversion->rateType->value,
                'exchange_rate_date'   => $conversion->rateDate->toDateString(),
                'exchange_rate_source' => $conversion->source,
            ];
        }

        if ($typed === null) {
            throw ValidationException::withMessages(['exchange_rate' => $missing->getMessage()]);
        }

        return [
            'exchange_rate'        => $typed,
            'exchange_rate_id'     => null,
            'exchange_rate_type'   => RateType::Transaction->value,
            'exchange_rate_date'   => $day->toDateString(),
            'exchange_rate_source' => self::SOURCE_MANUAL_INPUT,
        ];
    }

    /**
     * Mengunci baris kurs yang akan dirujuk dokumen di dalam transaksi dokumen, sehingga hapus/koreksi kurs yang
     * bersamaan menunggu (MySQL). Pengaman utamanya FK `restrictOnDelete` pada `exchange_rate_id` (SQLite mengabaikan
     * `lockForUpdate`): kurs yang terhapus di sela pencarian dan penyimpanan membuat dokumen gagal disimpan.
     */
    private function lockRate(?string $id): void {
        if ($id === null) {
            return;
        }

        if (! ExchangeRate::query()->whereKey($id)->lockForUpdate()->exists()) {
            throw ValidationException::withMessages(['exchange_rate' => __('finances/exchangeRate.errors.immutable_referenced')]);
        }
    }

    /** Kurs ketikan yang valid (> 0) sebagai string desimal, atau null bila kosong/0 (default kolom `payment_entries`). */
    private function typed(mixed $rate): ?string {
        if ($rate === null || $rate === '' || ! is_numeric($rate) || (float) $rate <= 0) {
            return null;
        }

        return Decimal::normalize(\is_string($rate) ? $rate : (float) $rate);
    }
}
