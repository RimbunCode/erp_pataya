<?php

namespace App\Services\Handlebar;

use Carbon\Carbon;
use Throwable;

/**
 * PHP port of the formatting Handlebars helpers registered in
 * `resources/js/lib/initHandlebar.js` (formatDate, formatCurrency,
 * formatNumber). Number formatting always uses Indonesian-style separators
 * (group ".", decimal ","), matching the JS implementation, which is
 * hardcoded to the same locale for these particular helpers.
 */
class FormatHelperService {
    protected const GROUP_SEPARATOR   = '.';
    protected const DECIMAL_SEPARATOR = ',';

    /**
     * Fallback currency symbol table — mirrors CURRENCY_SYMBOLS in
     * initHandlebar.js (formatCurrency only receives a currency code
     * string, not a resolved symbol).
     *
     * @var array<string, string>
     */
    protected const CURRENCY_SYMBOLS = [
        'IDR' => 'Rp',
        'USD' => '$',
        'EUR' => '€',
        'GBP' => '£',
        'JPY' => '¥',
        'SGD' => 'S$',
        'MYR' => 'RM',
    ];

    /**
     * Usage: {{formatDate date "DD/MM/YYYY"}}
     *
     * Supports the same user-friendly tokens as the JS helper (DD, MM,
     * YYYY, HH, mm, ss), translated to PHP/Carbon date() format tokens.
     */
    public function formatDate(mixed $value, mixed $format): string {
        if ($value === null || $value === '') {
            return '';
        }
        if (! is_string($format)) {
            return '[formatDate: format parameter must be a string]';
        }

        try {
            $phpFormat = strtr($format, [
                'YYYY' => 'Y',
                'DD'   => 'd',
                'MM'   => 'm',
                'HH'   => 'H',
                'mm'   => 'i',
                'ss'   => 's',
            ]);

            $date = $value instanceof \DateTimeInterface
                ? Carbon::instance($value)
                : Carbon::parse((string) $value, 'UTC');

            return $date->format($phpFormat);
        } catch (Throwable $e) {
            return "[formatDate error: {$e->getMessage()}]";
        }
    }

    /**
     * Usage: {{formatCurrency amount "IDR"}}
     */
    public function formatCurrency(mixed $value, mixed $currency): string {
        if ($value === null || $value === '') {
            return '';
        }
        if (! is_numeric($value)) {
            return '[formatCurrency: value must be a number or numeric string]';
        }
        if (! is_string($currency) || trim($currency) === '') {
            return '[formatCurrency: currency parameter must be a non-empty string (e.g. "IDR", "USD")]';
        }

        $code   = strtoupper(trim($currency));
        $symbol = self::CURRENCY_SYMBOLS[$code] ?? $code;

        return $this->formatNumberValue((float) $value, [
            'decimalScale' => 2,
            'prefix'       => "{$symbol} ",
        ]);
    }

    /**
     * Usage: {{formatNumber value 2}}
     */
    public function formatNumber(mixed $value, mixed $decimals): string {
        if ($value === null || $value === '') {
            return '';
        }
        if (! is_numeric($value)) {
            return '[formatNumber: value must be a number or numeric string]';
        }
        if (! is_int($decimals)) {
            return '[formatNumber: decimals parameter must be an integer]';
        }

        return $this->formatNumberValue((float) $value, ['decimalScale' => $decimals]);
    }

    /**
     * Port of formatNumber() from resources/js/Components/NumberInput/formatNumber.js,
     * restricted to the subset of options actually used by the Handlebars
     * helpers above (fixed group/decimal separators, optional prefix,
     * always-positive PrintTemplate values).
     *
     * @param  array{decimalScale?: int, prefix?: string}  $options
     */
    protected function formatNumberValue(float $value, array $options = []): string {
        $decimalScale = $options['decimalScale'] ?? null;
        $prefix       = $options['prefix'] ?? '';

        $isNegative = $value < 0;
        $absValue   = abs($value);

        if ($decimalScale !== null) {
            $rounded                    = number_format($absValue, $decimalScale, '.', '');
            [$integerStr, $fractionStr] = array_pad(explode('.', $rounded, 2), 2, '');
        } else {
            $plain                      = rtrim(rtrim(sprintf('%.20F', $absValue), '0'), '.');
            [$integerStr, $fractionStr] = array_pad(explode('.', $plain, 2), 2, '');
        }

        $integerStr = (string) preg_replace('/\B(?=(\d{3})+(?!\d))/', self::GROUP_SEPARATOR, $integerStr);

        $sign        = $isNegative ? '-' : '';
        $decimalPart = $fractionStr !== '' ? self::DECIMAL_SEPARATOR . $fractionStr : '';

        return "{$prefix}{$sign}{$integerStr}{$decimalPart}";
    }
}
