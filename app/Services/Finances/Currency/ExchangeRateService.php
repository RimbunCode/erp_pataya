<?php

namespace App\Services\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\NoExchangeRateException;
use App\Models\Finances\ExchangeRate;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Mencari kurs untuk pasangan mata uang, tipe, dan tanggal (Finance Fase 4, Requirement 2.1-2.2).
 *
 * Urutan: kurs pada tanggal tepat; bila tidak ada, kurs dengan tanggal terdekat SEBELUMNYA dalam batas
 * `finance_fx_max_age_days`; bila tetap tidak ada, `NoExchangeRateException` (gagal tertutup, tanpa kurs tebakan).
 *
 * Kurs kebalikan (`to -> from = 1/rate`) dipakai hanya bila `finance_fx_allow_inverse` aktif, dan dipertimbangkan
 * bersama kurs langsung: yang bertanggal paling baru menang; bila sama, kurs langsung. Hasil kebalikan berupa
 * instans `ExchangeRate` tidak tersimpan dengan `inverseOf` terisi, `rate = 1/rate` pada 8 digit desimal (HALF_UP).
 */
final class ExchangeRateService {
    public function __construct(private readonly SettingsService $settings) {}

    /**
     * @throws NoExchangeRateException
     */
    public function get(string $from, string $to, CarbonInterface $date, RateType $type): ExchangeRate {
        $day      = $date->toDateString();
        $settings = $this->settings->getForRead(FinanceSetting::class);
        $earliest = CarbonImmutable::parse($day)->subDays(max(0, (int) $settings->fx_max_age_days))->toDateString();

        $direct  = $this->latest($from, $to, $type, $day, $earliest);
        $inverse = $settings->fx_allow_inverse ? $this->latest($to, $from, $type, $day, $earliest) : null;

        if ($inverse !== null && ($direct === null || $inverse->rate_date->gt($direct->rate_date))) {
            return $this->invert($inverse);
        }

        return $direct ?? throw new NoExchangeRateException($from, $to, $type->value, $day);
    }

    private function latest(string $from, string $to, RateType $type, string $day, string $earliest): ?ExchangeRate {
        return ExchangeRate::query()
            ->where('from_currency_code', $from)
            ->where('to_currency_code', $to)
            ->where('rate_type', $type->value)
            ->where('rate_date', '<=', $day)
            ->where('rate_date', '>=', $earliest)
            ->orderByDesc('rate_date')
            ->first();
    }

    private function invert(ExchangeRate $stored): ExchangeRate {
        $inverse = new ExchangeRate;
        $inverse->forceFill([
            'from_currency_code' => $stored->to_currency_code,
            'to_currency_code'   => $stored->from_currency_code,
            'rate_type'          => $stored->rate_type,
            'rate'               => Decimal::divide('1', $stored->rate, ExchangeRate::RATE_SCALE),
            'rate_date'          => $stored->rate_date,
            'source'             => $stored->source,
            'source_ref'         => $stored->source_ref,
        ]);
        $inverse->inverseOf = $stored;

        return $inverse;
    }
}
