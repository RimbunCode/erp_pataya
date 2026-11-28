<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Models\Core\Currency;
use App\Models\Finances\ExchangeRate;
use App\Models\Finances\FinanceSetting;

/**
 * Pembantu test FX (Finance Fase 4): mata uang, kurs, dan setting FX.
 */
trait CreatesExchangeRates {
    /**
     * @param  array<string, int>  $codes  kode => minor unit
     */
    protected function seedCurrencies(array $codes = ['IDR' => 2, 'USD' => 2, 'EUR' => 2, 'JPY' => 0]): void {
        foreach ($codes as $code => $minorUnit) {
            Currency::query()->withoutGlobalScopes()->updateOrCreate(
                ['code' => $code],
                ['name' => $code, 'symbol' => $code, 'minor_unit' => $minorUnit],
            );
        }
    }

    protected function makeRate(
        string $from,
        string $to,
        string $rate,
        string $date,
        RateType $type = RateType::Transaction,
        string $source = ExchangeRate::SOURCE_MANUAL,
        bool $referenced = false,
    ): ExchangeRate {
        $row = (new ExchangeRate)->forceFill([
            'from_currency_code' => $from,
            'to_currency_code'   => $to,
            'rate_type'          => $type,
            'rate'               => $rate,
            'rate_date'          => $date,
            'source'             => $source,
        ]);
        $row->save();

        if ($referenced) {
            // Menandai dirujuk (false -> true) diizinkan; update berikutnya terkunci.
            $row->forceFill(['have_transactions' => true])->save();
        }

        return $row->refresh();
    }

    /**
     * @param  array<string, mixed>  $values
     */
    protected function setFxSettings(array $values): void {
        FinanceSetting::current()->forceFill($values)->save();
    }
}
