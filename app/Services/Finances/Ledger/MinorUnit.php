<?php

namespace App\Services\Finances\Ledger;

use InvalidArgumentException;
use RangeException;

/**
 * Pembulatan dan konversi ke minor unit mata uang (Finance Fase 1, Requirement 2.5 dan 7.3).
 *
 * Pembulatan HALF_UP (D-3) memakai `round()` PHP 8.4 yang membulatkan representasi desimal terdekat dengan benar
 * (mis. `round(1.005, 2)` = 1.01). Perbandingan keseimbangan dilakukan pada bilangan bulat minor unit agar bebas
 * galat floating point. Nilai di luar rentang bilangan bulat aman double (2^53 minor unit) ditolak, bukan dibiarkan
 * kehilangan presisi diam-diam.
 */
final class MinorUnit {
    /** Batas aman: bilangan bulat terbesar yang dapat direpresentasikan double secara eksak (2^53). */
    public const MAX_MINOR = 9_007_199_254_740_992;

    private const MAX_MINOR_UNIT_DIGITS = 6;

    private function __construct() {}

    /**
     * @throws InvalidArgumentException bila `$amount` bukan angka atau `$minorUnit` di luar 0..6
     * @throws RangeException bila nilai tidak berhingga atau di luar rentang aman
     */
    public static function round(float|int|string $amount, int $minorUnit): float {
        self::assertMinorUnit($minorUnit);
        $value = self::toFloat($amount);

        $rounded = round($value, $minorUnit);
        if (abs($rounded) * (10 ** $minorUnit) >= self::MAX_MINOR) {
            throw new RangeException('Amount is outside the supported range.');
        }

        // Hindari -0.0 (mis. round(-0.004, 2)) agar perbandingan dan serialisasi konsisten.
        return $rounded == 0.0 ? 0.0 : $rounded;
    }

    /**
     * Bilangan bulat minor unit setelah pembulatan HALF_UP (mis. 1.005 pada 2 desimal menjadi 101).
     */
    public static function toMinor(float|int|string $amount, int $minorUnit): int {
        return (int) round(self::round($amount, $minorUnit) * (10 ** $minorUnit));
    }

    /**
     * String desimal dengan tepat `$minorUnit` digit (mis. 10010 pada 2 desimal menjadi "100.10").
     */
    public static function fromMinor(int $minor, int $minorUnit): string {
        self::assertMinorUnit($minorUnit);

        $sign     = $minor < 0 ? '-' : '';
        $absolute = abs($minor);
        if ($minorUnit === 0) {
            return $sign . $absolute;
        }

        $divisor = 10 ** $minorUnit;

        return $sign . intdiv($absolute, $divisor) . '.' . str_pad((string) ($absolute % $divisor), $minorUnit, '0', STR_PAD_LEFT);
    }

    private static function assertMinorUnit(int $minorUnit): void {
        if ($minorUnit < 0 || $minorUnit > self::MAX_MINOR_UNIT_DIGITS) {
            throw new InvalidArgumentException('Minor unit must be between 0 and ' . self::MAX_MINOR_UNIT_DIGITS . ", got {$minorUnit}.");
        }
    }

    private static function toFloat(float|int|string $amount): float {
        if (\is_string($amount)) {
            if (! is_numeric($amount)) {
                throw new InvalidArgumentException("Amount is not numeric: {$amount}");
            }
            $amount = (float) $amount;
        }

        $value = (float) $amount;
        if (! is_finite($value)) {
            throw new RangeException('Amount must be finite.');
        }

        return $value;
    }
}
