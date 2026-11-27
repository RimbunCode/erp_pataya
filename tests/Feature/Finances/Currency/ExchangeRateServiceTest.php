<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\NoExchangeRateException;
use App\Models\Finances\ExchangeRate;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Currency\ExchangeRateService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 2.2 dan 2.4: pencarian kurs (tepat, terdekat sebelum dalam batas umur, kebalikan, gagal tertutup).
 */
class ExchangeRateServiceTest extends TestCase {
    use CreatesExchangeRates, RefreshDatabase;

    private ExchangeRateService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->seedCurrencies();
        $this->service = app(ExchangeRateService::class);
    }

    private function findRate(string $from, string $to, string $date, RateType $type = RateType::Transaction): ExchangeRate {
        return $this->service->get($from, $to, CarbonImmutable::parse($date), $type);
    }

    public function test_defaults_are_seven_days_and_inverse_allowed(): void {
        $settings = app(SettingsService::class)->getForRead(FinanceSetting::class);

        $this->assertSame(7, (int) $settings->fx_max_age_days);
        $this->assertTrue((bool) $settings->fx_allow_inverse);
    }

    public function test_exact_date_wins_over_earlier_dates(): void {
        $this->makeRate('USD', 'IDR', '15400', '2026-11-25');
        $exact = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $found = $this->findRate('USD', 'IDR', '2026-11-27');

        $this->assertTrue($found->is($exact));
        $this->assertFalse($found->isInverse());
        $this->assertSame('15500.00000000', $found->rate);
    }

    public function test_nearest_earlier_rate_is_used_within_max_age(): void {
        $this->makeRate('USD', 'IDR', '15300', '2026-11-18');
        $nearest = $this->makeRate('USD', 'IDR', '15400', '2026-11-21');

        $found = $this->findRate('USD', 'IDR', '2026-11-28');

        $this->assertTrue($found->is($nearest), 'Tepat 7 hari sebelumnya masih dalam batas umur.');
    }

    public function test_rate_older_than_max_age_fails_closed(): void {
        $this->makeRate('USD', 'IDR', '15400', '2026-11-20');

        try {
            $this->findRate('USD', 'IDR', '2026-11-28');
            $this->fail('Kurs 8 hari sebelumnya harus ditolak.');
        } catch (NoExchangeRateException $e) {
            $this->assertSame('USD', $e->from);
            $this->assertSame('IDR', $e->to);
            $this->assertSame('transaction', $e->rateType);
            $this->assertSame('2026-11-28', $e->date);
            foreach (['USD', 'IDR', 'transaction', '2026-11-28'] as $part) {
                $this->assertStringContainsString($part, $e->getMessage());
            }
        }
    }

    public function test_later_dated_rate_is_never_used(): void {
        $this->makeRate('USD', 'IDR', '15600', '2026-11-29');

        $this->expectException(NoExchangeRateException::class);
        $this->findRate('USD', 'IDR', '2026-11-28');
    }

    public function test_max_age_follows_the_setting(): void {
        $this->makeRate('USD', 'IDR', '15400', '2026-11-20');
        $this->setFxSettings(['fx_max_age_days' => 8]);

        $this->assertSame('15400.00000000', $this->findRate('USD', 'IDR', '2026-11-28')->rate);

        $this->setFxSettings(['fx_max_age_days' => 0]);
        $this->expectException(NoExchangeRateException::class);
        $this->findRate('USD', 'IDR', '2026-11-28');
    }

    public function test_rate_type_is_part_of_the_lookup(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27', RateType::Closing);

        $this->assertSame('15500.00000000', $this->findRate('USD', 'IDR', '2026-11-27', RateType::Closing)->rate);

        $this->expectException(NoExchangeRateException::class);
        $this->findRate('USD', 'IDR', '2026-11-27', RateType::Transaction);
    }

    public function test_inverse_rate_is_derived_and_flagged_when_allowed(): void {
        $stored = $this->makeRate('USD', 'IDR', '15800', '2026-11-27');

        $found = $this->findRate('IDR', 'USD', '2026-11-27');

        $this->assertTrue($found->isInverse());
        $this->assertTrue($found->inverseOf->is($stored));
        $this->assertSame('IDR', $found->from_currency_code);
        $this->assertSame('USD', $found->to_currency_code);
        $this->assertSame('0.00006329', $found->rate, '1/15800 pada 8 digit, HALF_UP.');
        $this->assertSame('2026-11-27', $found->rate_date->toDateString());
        $this->assertSame('15800.00000000', $stored->refresh()->rate, 'Baris tersimpan tidak berubah.');
    }

    public function test_inverse_result_cannot_be_saved(): void {
        $this->makeRate('USD', 'IDR', '15800', '2026-11-27');
        $found = $this->findRate('IDR', 'USD', '2026-11-27');

        $this->expectException(\LogicException::class);
        $found->save();
    }

    public function test_inverse_is_refused_when_the_setting_is_off(): void {
        $this->makeRate('USD', 'IDR', '15800', '2026-11-27');
        $this->setFxSettings(['fx_allow_inverse' => false]);

        $this->expectException(NoExchangeRateException::class);
        $this->findRate('IDR', 'USD', '2026-11-27');
    }

    public function test_more_recent_inverse_beats_older_direct_and_direct_wins_ties(): void {
        $this->makeRate('IDR', 'USD', '0.00006400', '2026-11-25');
        $this->makeRate('USD', 'IDR', '15800', '2026-11-27');

        $recent = $this->findRate('IDR', 'USD', '2026-11-28');
        $this->assertTrue($recent->isInverse(), 'Kebalikan bertanggal 27 lebih baru daripada langsung bertanggal 25.');

        $this->makeRate('IDR', 'USD', '0.00006300', '2026-11-27');
        $tie = $this->findRate('IDR', 'USD', '2026-11-28');
        $this->assertFalse($tie->isInverse(), 'Tanggal sama: kurs langsung menang.');
        $this->assertSame('0.00006300', $tie->rate);
    }

    public function test_missing_pair_fails_closed(): void {
        $this->expectException(NoExchangeRateException::class);

        $this->findRate('EUR', 'IDR', '2026-11-27');
    }
}
