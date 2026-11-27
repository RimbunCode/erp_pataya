<?php

namespace App\Services\Finances\Currency;

use InvalidArgumentException;

/**
 * Aritmetika desimal berbasis string (bcmath) untuk kurs dan konversi (Finance Fase 4, Requirement 2.3): tanpa
 * `float` pada perkalian/pembagian, sehingga tidak ada drift. Pembulatan HALF_UP menjauhi nol (sama dengan
 * `MinorUnit::round`, D-3), termasuk untuk nilai negatif.
 *
 * Asumsi: ekstensi `bcmath` tersedia (tidak dideklarasikan di `composer.json`; lihat pertanyaan terbuka Fase 4).
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

    /** Perkalian eksak (skala hasil = jumlah skala kedua operan). */
    public static function multiply(string $a, string $b): string {
        return bcmul($a, $b, self::scale($a) + self::scale($b));
    }

    /**
     * `$a / $b` dibulatkan HALF_UP ke `$scale` digit. Dipotong pada digit ke `$scale + 1` lalu dibulatkan; hasilnya
     * identik dengan pembulatan nilai eksak karena keputusan hanya bergantung pada digit tersebut.
     */
    public static function divide(string $a, string $b, int $scale): string {
        if (bccomp($b, '0', 12) === 0) {
            throw new \DivisionByZeroError('Division by zero.');
        }

        return self::roundHalfUp(bcdiv($a, $b, $scale + 1), $scale);
    }

    /** Pembulatan HALF_UP (menjauhi nol) ke `$scale` digit desimal; hasil selalu bertepatan `$scale` digit. */
    public static function roundHalfUp(string $value, int $scale): string {
        $negative = str_starts_with($value, '-');
        $absolute = ltrim($value, '-');
        $half     = '0.' . str_repeat('0', $scale) . '5';
        $rounded  = bcadd($absolute, $half, $scale);

        if ($negative && bccomp($rounded, '0', $scale) !== 0) {
            return '-' . $rounded;
        }

        return $rounded;
    }
}
