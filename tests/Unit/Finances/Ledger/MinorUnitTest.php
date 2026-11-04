<?php

namespace Tests\Unit\Finances\Ledger;

use App\Services\Finances\Ledger\MinorUnit;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RangeException;

/**
 * Finance Fase 1, Task 4.1: pembulatan HALF_UP ke minor unit dan konversi ke bilangan bulat untuk perbandingan
 * keseimbangan (Requirement 2.5, 7.3). PHP 8.4 `round()` sudah membulatkan representasi desimal terdekat dengan
 * benar (mis. `round(1.005, 2)` = 1.01), jadi tidak ada pra-pembulatan sendiri.
 */
class MinorUnitTest extends TestCase {
    /**
     * @return array<string, array{0: float|int|string, 1: int, 2: float}>
     */
    public static function roundingCases(): array {
        return [
            '1.005 pada 2 desimal'     => [1.005, 2, 1.01],
            '0.125 pada 2 desimal'     => [0.125, 2, 0.13],
            '2.675 pada 2 desimal'     => [2.675, 2, 2.68],
            'negatif setengah'         => [-1.005, 2, -1.01],
            'string numerik'           => ['10.555', 2, 10.56],
            'integer'                  => [1500, 2, 1500.0],
            'minor unit 0 (JPY)'       => [1234.5, 0, 1235.0],
            'minor unit 0 di bawah .5' => [1234.4999, 0, 1234.0],
            'minor unit 3 (KWD)'       => [1.0005, 3, 1.001],
            'nilai besar'              => [1234567890.125, 2, 1234567890.13],
            'nol'                      => [0, 2, 0.0],
            'di bawah setengah satuan' => [0.004, 2, 0.0],
        ];
    }

    #[DataProvider('roundingCases')]
    public function test_round_uses_half_up(float|int|string $amount, int $minorUnit, float $expected): void {
        $this->assertSame($expected, MinorUnit::round($amount, $minorUnit));
    }

    /**
     * @return array<string, array{0: float|int|string, 1: int, 2: int}>
     */
    public static function minorCases(): array {
        return [
            '1.005 pada 2 desimal'   => [1.005, 2, 101],
            '0.125 pada 2 desimal'   => [0.125, 2, 13],
            'negatif'                => [-12.345, 2, -1235],
            'string numerik'         => ['100.10', 2, 10010],
            'minor unit 0'           => [1234.5, 0, 1235],
            'minor unit 3'           => [1.2345, 3, 1235],
            'nilai besar masih aman' => [9_000_000_000_000.00, 2, 900_000_000_000_000],
            'nol'                    => [0.0, 2, 0],
        ];
    }

    #[DataProvider('minorCases')]
    public function test_to_minor_returns_integer_minor_units(float|int|string $amount, int $minorUnit, int $expected): void {
        $this->assertSame($expected, MinorUnit::toMinor($amount, $minorUnit));
    }

    public function test_to_minor_is_stable_for_amounts_that_float_multiplication_would_misround(): void {
        // 0.1 + 0.2 = 0.30000000000000004; 1.15 * 100 = 114.99999999999999
        $this->assertSame(30, MinorUnit::toMinor(0.1 + 0.2, 2));
        $this->assertSame(115, MinorUnit::toMinor(1.15, 2));
        $this->assertSame(1005, MinorUnit::toMinor(10.05, 2));
    }

    public function test_to_minor_rejects_values_beyond_the_safe_integer_range(): void {
        $this->expectException(RangeException::class);

        MinorUnit::toMinor(9.1e13, 2);
    }

    public function test_to_minor_rejects_non_finite_values(): void {
        $this->expectException(RangeException::class);

        MinorUnit::toMinor(INF, 2);
    }

    public function test_to_minor_rejects_non_numeric_strings(): void {
        $this->expectException(InvalidArgumentException::class);

        MinorUnit::toMinor('abc', 2);
    }

    public function test_minor_unit_must_be_between_zero_and_six(): void {
        $this->expectException(InvalidArgumentException::class);

        MinorUnit::toMinor(1, 7);
    }

    /**
     * @return array<string, array{0: int, 1: int, 2: string}>
     */
    public static function fromMinorCases(): array {
        return [
            'dua desimal'              => [10010, 2, '100.10'],
            'kurang dari satu'         => [5, 2, '0.05'],
            'negatif'                  => [-1235, 2, '-12.35'],
            'minor unit 0'             => [1235, 0, '1235'],
            'minor unit 3'             => [1235, 3, '1.235'],
            'nol'                      => [0, 2, '0.00'],
            'negatif kurang dari satu' => [-5, 2, '-0.05'],
        ];
    }

    #[DataProvider('fromMinorCases')]
    public function test_from_minor_formats_as_decimal_string(int $minor, int $minorUnit, string $expected): void {
        $this->assertSame($expected, MinorUnit::fromMinor($minor, $minorUnit));
    }

    public function test_round_trip_through_minor_units_preserves_the_rounded_value(): void {
        mt_srand(20261104);
        for ($i = 0; $i < 500; $i++) {
            $amount = mt_rand(0, 99_999_999) / 100 + mt_rand(0, 9) / 1000;
            $minor  = MinorUnit::toMinor($amount, 2);

            $this->assertSame(MinorUnit::round($amount, 2), (float) MinorUnit::fromMinor($minor, 2));
        }
    }
}
