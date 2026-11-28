<?php

namespace App\Services\Finances\Currency;

use Brick\Math\BigDecimal;
use Brick\Math\Exception\DivisionByZeroException as MathDivisionByZeroException;
use Brick\Math\RoundingMode;
use InvalidArgumentException;

/**
 * Aritmetika desimal berbasis string (`Brick\Math\BigDecimal`, dependensi transitif `laravel/framework`) untuk kurs dan
 * konversi (Finance Fase 4, Requirement 2.3): tanpa `float` pada perkalian/pembagian dan tanpa luapan bilangan bulat.
 * Pembulatan HALF_UP menjauhi nol (sama dengan `MinorUnit::round`, D-3), termasuk untuk nilai negatif.
 */
final class Decimal {
    private function __construct() {}

    /**
     * Normalisasi angka ke string desimal polos (tanpa notasi ilmiah, tanpa `+`). `float` dikonversi lewat representasi
     * terpendek yang dapat dibaca balik (bukan `%.Nf` yang menampakkan galat biner).
     *
     * @throws InvalidArgumentException bila bukan angka berhingga
     */
    public static function normalize(float|int|string $value): string {
        if (\is_float($value)) {
            if (! is_finite($value)) {
                throw new InvalidArgumentException('Amount must be finite.');
            }
            $value = json_encode($value);
            if (str_contains($value, 'e') || str_contains($value, 'E')) {
                $value = rtrim(rtrim(\sprintf('%.12F', (float) $value), '0'), '.');
            }
        }

        $value = trim((string) $value);
        if (! preg_match('/^[+-]?\d+(\.\d+)?$/', $value)) {
            throw new InvalidArgumentException("Amount is not a plain decimal number: {$value}");
        }

        $value = ltrim($value, '+');
        $sign  = '';
        if (str_starts_with($value, '-')) {
            $sign  = '-';
            $value = substr($value, 1);
        }
        $value = ltrim($value, '0');
        if ($value === '' || $value[0] === '.') {
            $value = '0' . $value;
        }
        if (str_contains($value, '.')) {
            $value = rtrim(rtrim($value, '0'), '.');
        }

        return $value === '0' ? '0' : $sign . $value;
    }

    /** Jumlah digit desimal pada string hasil `normalize`. */
    public static function scale(string $value): int {
        $position = strpos($value, '.');

        return $position === false ? 0 : \strlen($value) - $position - 1;
    }

    /** Perbandingan numerik eksak: -1, 0, atau 1 (skala berbeda diperlakukan sama: "1.0" == "1"). */
    public static function compare(string $a, string $b): int {
        return BigDecimal::of($a)->compareTo($b);
    }

    /** Perkalian eksak (skala hasil = jumlah skala kedua operan). */
    public static function multiply(string $a, string $b): string {
        return (string) BigDecimal::of($a)->multipliedBy($b);
    }

    /** `$a / $b` dibulatkan HALF_UP (menjauhi nol) ke `$scale` digit, dihitung dari nilai eksak. */
    public static function divide(string $a, string $b, int $scale): string {
        try {
            return (string) BigDecimal::of($a)->dividedBy($b, $scale, RoundingMode::HalfUp);
        } catch (MathDivisionByZeroException) {
            throw new \DivisionByZeroError('Division by zero.');
        }
    }

    /** Pembulatan HALF_UP (menjauhi nol) ke `$scale` digit desimal; hasil selalu bertepatan `$scale` digit. */
    public static function roundHalfUp(string $value, int $scale): string {
        return (string) BigDecimal::of($value)->toScale($scale, RoundingMode::HalfUp);
    }
}
