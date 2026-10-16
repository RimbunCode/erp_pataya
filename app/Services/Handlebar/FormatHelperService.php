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
     * Peta nama bulan Bahasa Indonesia ke Bahasa Inggris agar string tanggal
     * yang sudah lebih dulu diformat `formatData()` (mis. "31 Agustus 2026")
     * tetap dapat di-parse ulang oleh Carbon ketika template memanggil
     * `{{formatDate ...}}`.
     *
     * @var array<string, string>
     */
    protected const ID_MONTH_MAP = [
        'Januari'   => 'January',
        'Februari'  => 'February',
        'Maret'     => 'March',
        'April'     => 'April',
        'Mei'       => 'May',
        'Juni'      => 'June',
        'Juli'      => 'July',
        'Agustus'   => 'August',
        'September' => 'September',
        'Oktober'   => 'October',
        'November'  => 'November',
        'Desember'  => 'December',
        'Agu'       => 'Aug',
        'Okt'       => 'Oct',
        'Des'       => 'Dec',
    ];

    /**
     * Usage: {{formatDate date "DD/MM/YYYY"}}
     *
     * Supports the same user-friendly tokens as the JS helper (DD, MM, MMM,
     * MMMM, YYYY, HH, mm, ss), translated to PHP/Carbon date() format tokens.
     */
    public function formatDate(mixed $value, mixed $format, ?string $locale = null): string {
        if ($value === null || $value === '') {
            return '';
        }
        if (! is_string($format)) {
            return '[formatDate: format parameter must be a string]';
        }

        try {
            $phpFormat = strtr($format, [
                'YYYY' => 'Y',
                'MMMM' => 'F',
                'MMM'  => 'M',
                'MM'   => 'm',
                'DD'   => 'd',
                'HH'   => 'H',
                'mm'   => 'i',
                'ss'   => 's',
            ]);

            $effectiveLocale = $locale;
            if ($value instanceof \DateTimeInterface) {
                $date = Carbon::instance($value);
            } else {
                [$normalized, $detectedLocale] = $this->normalizeDateString((string) $value);
                $effectiveLocale ??= $detectedLocale;
                $date = Carbon::parse($normalized, 'UTC');
            }

            if ($effectiveLocale !== null && $effectiveLocale !== '') {
                return $date->locale($effectiveLocale)->translatedFormat($phpFormat);
            }

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
        $numeric = $this->normalizeNumericValue($value);
        if ($numeric === null) {
            return '[formatCurrency: value must be a number or numeric string]';
        }
        if (! is_string($currency) || trim($currency) === '') {
            return '[formatCurrency: currency parameter must be a non-empty string (e.g. "IDR", "USD")]';
        }

        $code   = strtoupper(trim($currency));
        $symbol = self::CURRENCY_SYMBOLS[$code] ?? $code;

        return $this->formatNumberValue($numeric, [
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
        $numeric = $this->normalizeNumericValue($value);
        if ($numeric === null) {
            return '[formatNumber: value must be a number or numeric string]';
        }
        if (! is_int($decimals)) {
            return '[formatNumber: decimals parameter must be an integer]';
        }

        return $this->formatNumberValue($numeric, ['decimalScale' => $decimals]);
    }

    /**
     * Menormalkan nilai numerik baik yang masih mentah (int/float/numeric string)
     * maupun yang sudah terformat `formatData()` (mis. "777.190", "1.234,50",
     * "Rp 50.000") kembali ke float supaya helper `formatNumber` dan
     * `formatCurrency` tidak gagal atau salah baca pemisah ribuan sebagai desimal.
     */
    protected function normalizeNumericValue(mixed $value): ?float {
        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }
        if (! is_string($value)) {
            return null;
        }

        $cleaned = trim($value);
        if ($cleaned === '') {
            return null;
        }

        // Buang prefix simbol/kode mata uang bila kolom bertipe `currency` sudah
        // diformat lebih dulu oleh formatData() (mis. "Rp 50.000" atau "S$ 1.000").
        $cleaned = (string) preg_replace('/^[A-Za-z$€£¥]+\s+/u', '', $cleaned);

        // Format Indonesia dengan koma desimal (mis. "1.234,56" atau "100,5").
        if (preg_match('/^-?\d{1,3}(?:\.\d{3})*,\d+$/', $cleaned) || preg_match('/^-?\d+,\d+$/', $cleaned)) {
            $cleaned = str_replace(['.', ','], ['', '.'], $cleaned);

            return is_numeric($cleaned) ? (float) $cleaned : null;
        }

        // Format ribuan Indonesia tanpa desimal dari formatData() (mis. "5.000", "172.000.000").
        if (preg_match('/^-?\d{1,3}(?:\.\d{3})+$/', $cleaned)) {
            $cleaned = str_replace('.', '', $cleaned);

            return is_numeric($cleaned) ? (float) $cleaned : null;
        }

        // Format ribuan Inggris (mis. "5,000" atau "1,234.50").
        if (preg_match('/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/', $cleaned)) {
            $cleaned = str_replace(',', '', $cleaned);

            return is_numeric($cleaned) ? (float) $cleaned : null;
        }

        return is_numeric($cleaned) ? (float) $cleaned : null;
    }

    /**
     * Mengubah nama bulan Bahasa Indonesia pada string tanggal hasil `formatData()`
     * menjadi Bahasa Inggris agar dapat di-parse `Carbon::parse()`.
     *
     * @return array{0: string, 1: string|null}
     */
    protected function normalizeDateString(string $value): array {
        $detectedLocale = null;
        $normalized     = $value;

        foreach (self::ID_MONTH_MAP as $idMonth => $enMonth) {
            $replaced = preg_replace('/\b' . preg_quote($idMonth, '/') . '\b/iu', $enMonth, $normalized);
            if ($replaced !== null && $replaced !== $normalized) {
                $normalized     = $replaced;
                $detectedLocale = 'id';
            }
        }

        return [$normalized, $detectedLocale];
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
