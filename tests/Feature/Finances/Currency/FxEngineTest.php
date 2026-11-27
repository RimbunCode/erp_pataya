<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\NoExchangeRateException;
use App\Models\Core\CoreSetting;
use App\Services\Finances\Currency\Decimal;
use App\Services\Finances\Currency\FxConversion;
use App\Services\Finances\Currency\FxEngine;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 2.3 dan 2.4: konversi dapat dijelaskan, aritmetika tanpa float, HALF_UP ke minor unit tujuan.
 */
class FxEngineTest extends TestCase {
    use CreatesExchangeRates, RefreshDatabase;

    private FxEngine $engine;

    protected function setUp(): void {
        parent::setUp();
        $this->seedCurrencies();
        $this->engine = app(FxEngine::class);
    }

    private function convert(float|int|string $amount, string $from, string $to, string $date = '2026-11-27', RateType $type = RateType::Transaction): FxConversion {
        return $this->engine->convert($amount, $from, $to, CarbonImmutable::parse($date), $type);
    }

    public function test_direct_conversion_returns_amount_and_explanation(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27', source: 'import');

        $result = $this->convert(1000, 'USD', 'IDR');

        $this->assertSame('15500000.00', $result->amount);
        $this->assertSame('15500.00000000', $result->rate);
        $this->assertSame(RateType::Transaction, $result->rateType);
        $this->assertSame('2026-11-27', $result->rateDate->toDateString());
        $this->assertSame('import', $result->source);
        $this->assertFalse($result->inverse);
        $this->assertSame(['USD', 'IDR'], [$result->from, $result->to]);
    }

    public function test_same_currency_returns_the_same_amount_without_a_rate_lookup(): void {
        $result = $this->convert('1234.5', 'IDR', 'IDR');

        $this->assertSame('1234.5', $result->amount);
        $this->assertSame('1', $result->rate);
        $this->assertSame(FxConversion::SOURCE_IDENTITY, $result->source);
        $this->assertFalse($result->inverse);
    }

    public function test_the_conversion_is_serializable_for_the_ui(): void {
        $stored = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $result = $this->convert(2, 'USD', 'IDR');

        $expected = [
            'amount'           => '31000.00',
            'rate'             => '15500.00000000',
            'rate_type'        => 'transaction',
            'rate_date'        => '2026-11-27',
            'source'           => 'manual',
            'inverse'          => false,
            'from'             => 'USD',
            'to'               => 'IDR',
            'exchange_rate_id' => $stored->getKey(),
            'stored_rate'      => '15500.00000000',
        ];
        $this->assertSame($expected, $result->toArray());
        $this->assertSame($expected, json_decode(json_encode($result), true));
    }

    public function test_the_conversion_exposes_the_stored_row_and_rate_so_consumers_can_recompute(): void {
        $stored = $this->makeRate('USD', 'IDR', '15800', '2026-11-27');

        $inverse = $this->convert('15800000', 'IDR', 'USD');
        $direct  = $this->convert('1000', 'USD', 'IDR');
        $same    = $this->convert('5', 'IDR', 'IDR');

        $this->assertTrue($inverse->inverse);
        $this->assertSame($stored->getKey(), $inverse->exchangeRateId);
        $this->assertSame('15800.00000000', $inverse->storedRate, 'kurs apa adanya di baris, bukan 1/rate');
        $this->assertSame('0.00006329', $inverse->rate, 'penjelasan saja');
        // Konsumen menghitung ulang: kebalikan = amount / storedRate.
        $this->assertSame($inverse->amount, Decimal::divide('15800000', $inverse->storedRate, 2));

        $this->assertFalse($direct->inverse);
        $this->assertSame($stored->getKey(), $direct->exchangeRateId);
        $this->assertSame('15800.00000000', $direct->storedRate);

        $this->assertNull($same->exchangeRateId);
        $this->assertSame('1', $same->storedRate);
    }

    public function test_identity_conversion_does_not_round_to_minor_units(): void {
        $this->assertSame('10.12345', $this->convert('10.12345', 'USD', 'USD')->amount);
    }

    public function test_inverse_conversion_divides_by_the_stored_rate_instead_of_using_a_rounded_inverse(): void {
        $this->makeRate('USD', 'IDR', '15800', '2026-11-27');

        $result = $this->convert('15800000', 'IDR', 'USD');

        $this->assertSame('1000.00', $result->amount, 'Mengalikan dengan 1/15800 yang dibulatkan akan menghasilkan 999.98.');
        $this->assertTrue($result->inverse);
        $this->assertSame('0.00006329', $result->rate);
    }

    public function test_half_up_rounding_at_the_target_minor_unit(): void {
        $this->makeRate('USD', 'EUR', '0.1', '2026-11-27');
        $this->makeRate('USD', 'JPY', '150.5', '2026-11-27');

        // 0.05 x 0.1 = 0.005 -> 0.01 (HALF_UP); float memberi 0.0050000000000000001 atau 0.00 tergantung jalurnya.
        $this->assertSame('0.01', $this->convert('0.05', 'USD', 'EUR')->amount);
        // minor unit 0: 3 x 150.5 = 451.5 -> 452; negatif menjauhi nol -> -452.
        $this->assertSame('452', $this->convert(3, 'USD', 'JPY')->amount);
        $this->assertSame('-452', $this->convert(-3, 'USD', 'JPY')->amount);
        $this->assertSame('15125', $this->convert('100.5', 'USD', 'JPY')->amount, '15125.25 dibulatkan ke 15125.');
    }

    public function test_float_inputs_do_not_introduce_binary_noise(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $this->makeRate('USD', 'EUR', '100', '2026-11-27');

        $this->assertSame('1550.00', $this->convert(0.1, 'USD', 'IDR')->amount);
        // Float 1.005 dibaca sebagai "1.005" (bukan 1.00499999...): 1.005 x 100 = 100.500 -> 100.50.
        $this->assertSame('100.50', $this->convert(1.005, 'USD', 'EUR')->amount);
    }

    public function test_very_small_and_very_large_rates_and_amounts(): void {
        $this->makeRate('IDR', 'USD', '0.00006452', '2026-11-27');
        $this->makeRate('EUR', 'JPY', '12345678.12345', '2026-11-27');

        $this->assertSame('1019416.00', $this->convert('15800000000', 'IDR', 'USD')->amount);
        // 1 x 12345678.12345 = 12345678.12345 -> JPY tanpa desimal.
        $this->assertSame('12345678', $this->convert(1, 'EUR', 'JPY')->amount);
        // Jumlah besar tanpa luapan bilangan bulat 64-bit: 1.234.567.890.123,45 x 0,00006452 (minor unit USD 2).
        $this->assertSame('79654320.27', $this->convert('1234567890123.45', 'IDR', 'USD')->amount);
    }

    public function test_missing_rate_fails_closed_with_a_useful_exception(): void {
        $this->expectException(NoExchangeRateException::class);

        $this->convert(100, 'USD', 'IDR');
    }

    public function test_rate_type_is_respected(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27', RateType::Transaction);
        $this->makeRate('USD', 'IDR', '15900', '2026-11-27', RateType::Closing);

        $this->assertSame('15900000.00', $this->convert(1000, 'USD', 'IDR', type: RateType::Closing)->amount);
        $this->assertSame('15500000.00', $this->convert(1000, 'USD', 'IDR', type: RateType::Transaction)->amount);
    }

    public function test_base_currency_reads_the_general_setting(): void {
        $this->assertNull($this->engine->baseCurrency());

        CoreSetting::current()->forceFill(['default_currency_id' => 'IDR'])->save();

        $this->assertSame('IDR', app(FxEngine::class)->baseCurrency());
    }

    public function test_non_numeric_amount_is_rejected(): void {
        $this->expectException(\InvalidArgumentException::class);

        $this->convert('abc', 'USD', 'IDR');
    }
}
