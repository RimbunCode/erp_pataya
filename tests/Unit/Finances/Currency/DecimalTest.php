<?php

namespace Tests\Unit\Finances\Currency;

use App\Services\Finances\Currency\Decimal;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Finance Fase 4, Task 2.3: aritmetika desimal string untuk FX (tanpa float, HALF_UP menjauhi nol).
 */
class DecimalTest extends TestCase {
    /**
     * @return array<string, array{0: float|int|string, 1: string}>
     */
    public static function normalizeCases(): array {
        return [
            'integer string'          => ['100', '100'],
            'trailing zeros trimmed'  => ['15500.00000000', '15500'],
            'keeps integer zeros'     => ['1000', '1000'],
            'leading zeros trimmed'   => ['007.50', '7.5'],
            'plus sign'               => ['+3.25', '3.25'],
            'negative'                => ['-0.50', '-0.5'],
            'negative zero'           => ['-0.00', '0'],
            'float shortest repr'     => [1234567.89, '1234567.89'],
            'float binary noise-free' => [0.1, '0.1'],
            'float exponent'          => [1.0E-7, '0.0000001'],
            'int'                     => [42, '42'],
        ];
    }

    #[DataProvider('normalizeCases')]
    public function test_normalize(float|int|string $input, string $expected): void {
        $this->assertSame($expected, Decimal::normalize($input));
    }

    public function test_normalize_rejects_non_numeric_and_non_finite(): void {
        foreach (['abc', '1e5', '1,5', '', '--1'] as $bad) {
            try {
                Decimal::normalize($bad);
                $this->fail("'{$bad}' seharusnya ditolak.");
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->expectException(InvalidArgumentException::class);
        Decimal::normalize(NAN);
    }

    /**
     * @return array<string, array{0: string, 1: int, 2: string}>
     */
    public static function roundCases(): array {
        return [
            'half up at 2'          => ['1.005', 2, '1.01'],
            'below half'            => ['1.0049999', 2, '1.00'],
            'negative half away'    => ['-1.005', 2, '-1.01'],
            'negative below half'   => ['-1.0049', 2, '-1.00'],
            'scale 0 half'          => ['451.5', 0, '452'],
            'scale 0 negative half' => ['-451.5', 0, '-452'],
            'scale 0 below half'    => ['451.4999', 0, '451'],
            'pads scale'            => ['12', 2, '12.00'],
            'carry over'            => ['9.995', 2, '10.00'],
            'rounds to zero'        => ['-0.004', 2, '0.00'],
            'zero stays zero'       => ['0', 2, '0.00'],
        ];
    }

    #[DataProvider('roundCases')]
    public function test_round_half_up(string $value, int $scale, string $expected): void {
        $this->assertSame($expected, Decimal::roundHalfUp($value, $scale));
    }

    public function test_multiply_is_exact(): void {
        $this->assertSame('15500000.0', Decimal::multiply('1000', '15500.0'));
        $this->assertSame('0.005000', Decimal::multiply('0.05', '0.1000'));
        $this->assertSame('1019416.' . str_repeat('0', 11), Decimal::multiply('15800000000.000', '0.00006452'));
    }

    public function test_values_beyond_64_bit_integers_do_not_overflow(): void {
        // 1e16 minor unit x rate 1e8 = 1e24 (jauh di atas PHP_INT_MAX ~ 9.2e18).
        $this->assertSame('1000000000000000000000000', Decimal::multiply('10000000000000000', '100000000'));
        $this->assertSame('1000000000000000000000000.00', Decimal::roundHalfUp(Decimal::multiply('10000000000000000', '100000000'), 2));
        // 1e9 unit mata uang (1e11 minor unit pada skala 2) x 99999999.99999999.
        $this->assertSame('99999999999999990.00000000000000', Decimal::multiply('1000000000.000000', '99999999.99999999'));
        $this->assertSame('1000000000000000000.00', Decimal::divide('1000000000000000000000000', '1000000', 2));
        $this->assertSame('0.00', Decimal::roundHalfUp('0.004999999999999999999999', 2));
        $this->assertSame(0, Decimal::compare('1.0', '1'));
        $this->assertSame(-1, Decimal::compare('0.00000001', '0.0000001'));
    }

    public function test_divide_rounds_half_up_to_the_requested_scale(): void {
        $this->assertSame('1000.00', Decimal::divide('15800000', '15800', 2));
        $this->assertSame('0.33333333', Decimal::divide('1', '3', 8));
        $this->assertSame('0.66666667', Decimal::divide('2', '3', 8));
        $this->assertSame('0.00006452', Decimal::divide('1', '15500', 8));
        $this->assertSame('-0.67', Decimal::divide('-2', '3', 2));
    }

    public function test_divide_by_zero_throws(): void {
        $this->expectException(\DivisionByZeroError::class);

        Decimal::divide('1', '0', 2);
    }

    public function test_scale(): void {
        $this->assertSame(0, Decimal::scale('15'));
        $this->assertSame(3, Decimal::scale('1.234'));
    }
}
