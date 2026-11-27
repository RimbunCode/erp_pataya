<?php

namespace App\Services\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\NoExchangeRateException;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\Iso4217;
use Carbon\CarbonInterface;

/**
 * Konversi mata uang yang dapat dijelaskan (Finance Fase 4, Requirement 2.3-2.4). Aritmetika bcmath tanpa `float`;
 * pembulatan HALF_UP ke minor unit mata uang tujuan (`currencies.minor_unit`).
 *
 * - `from = to`: jumlah yang sama, `rate = 1`, tanpa pencarian kurs.
 * - Kurs langsung: `amount × rate`.
 * - Kurs kebalikan: `amount ÷ rate tersimpan`, bukan `amount × (1/rate dibulatkan 8 digit)`, agar tidak ada selisih
 *   pembulatan kurs (mis. 15.800.000 IDR dengan kurs USD→IDR 15800 harus tepat 1000,00 USD). `FxConversion::$rate`
 *   menampilkan `1/rate` (8 digit) hanya sebagai penjelasan.
 */
final class FxEngine {
    public function __construct(
        private readonly ExchangeRateService $rates,
        private readonly SettingsService $settings,
    ) {}

    /**
     * @throws NoExchangeRateException
     * @throws \InvalidArgumentException bila `$amount` bukan angka berhingga
     */
    public function convert(float|int|string $amount, string $from, string $to, CarbonInterface $date, RateType $type): FxConversion {
        $normalized = Decimal::normalize($amount);

        if ($from === $to) {
            return new FxConversion($normalized, '1', $type, $date, FxConversion::SOURCE_IDENTITY, false, $from, $to);
        }

        $rate      = $this->rates->get($from, $to, $date, $type);
        $minorUnit = $this->minorUnit($to);

        $converted = $rate->isInverse()
            ? Decimal::divide($normalized, $rate->inverseOf->rate, $minorUnit)
            : Decimal::roundHalfUp(Decimal::multiply($normalized, $rate->rate), $minorUnit);

        return new FxConversion(
            amount: $converted,
            rate: $rate->rate,
            rateType: $rate->rate_type,
            rateDate: $rate->rate_date,
            source: $rate->source,
            inverse: $rate->isInverse(),
            from: $from,
            to: $to,
        );
    }

    /** Mata uang dasar: setting umum `default_currency_id` (null bila belum diatur). */
    public function baseCurrency(): ?string {
        $code = $this->settings->getForRead(CoreSetting::class)->default_currency_id;

        return $code === null || $code === '' ? null : (string) $code;
    }

    private function minorUnit(string $code): int {
        $minorUnit = Currency::query()->withoutGlobalScopes()->whereKey($code)->value('minor_unit');

        return $minorUnit === null ? Iso4217::DEFAULT_MINOR_UNIT : (int) $minorUnit;
    }
}
