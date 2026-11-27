<?php

namespace App\Services\Finances\Currency\Providers;

use App\Models\Finances\ExchangeRate;
use App\Services\Finances\Currency\ExchangeRateRecorder;

/**
 * Penyedia kurs dari berkas CSV (Finance Fase 4, Requirement 1.4): validasi per baris, laporan galat dengan nomor
 * baris berkas, tanpa jaringan, `source = import`.
 *
 * Format: baris pertama header dengan kolom `from_currency_code,to_currency_code,rate_type,rate,rate_date`
 * (urutan bebas; kolom lain diabaikan); nama berkas menjadi `source_ref`. Pemisah `,` atau `;` (dideteksi dari header), BOM UTF-8 diabaikan, baris kosong dilewati. Baris valid tetap tersimpan
 * walau baris lain galat; impor ulang berkas yang sama idempoten.
 */
final class CsvImportProvider implements ExchangeRateProvider {
    public const COLUMNS = ['from_currency_code', 'to_currency_code', 'rate_type', 'rate', 'rate_date'];

    public function __construct(private readonly ExchangeRateRecorder $recorder) {}

    public function source(): string {
        return ExchangeRate::SOURCE_IMPORT;
    }

    public function ingest(iterable $rows, ?string $sourceRef = null, ?string $createdById = null): RateImportReport {
        return $this->recorder->ingest($rows, $this->source(), $sourceRef, $createdById);
    }

    /**
     * Mengimpor berkas CSV di `$path`.
     */
    public function importFile(string $path, ?string $createdById = null): RateImportReport {
        $content = @file_get_contents($path);
        if ($content === false) {
            $report = new RateImportReport;
            $report->addError(0, __('finances/exchangeRate.errors.csv_unreadable'));

            return $report;
        }

        return $this->importString($content, basename($path), $createdById);
    }

    /**
     * Mengimpor isi CSV; `$sourceRef` biasanya nama berkas.
     */
    public function importString(string $csv, ?string $sourceRef = null, ?string $createdById = null): RateImportReport {
        $csv    = preg_replace('/^\xEF\xBB\xBF/', '', $csv) ?? $csv;
        $lines  = preg_split('/\r\n|\n|\r/', $csv) ?: [];
        $report = new RateImportReport;

        $headerLine = null;
        $header     = [];
        $delimiter  = ',';
        $rows       = [];

        foreach ($lines as $index => $text) {
            $lineNumber = $index + 1;
            if (trim($text) === '') {
                continue;
            }

            if ($headerLine === null) {
                $delimiter  = substr_count($text, ';') > substr_count($text, ',') ? ';' : ',';
                $header     = array_map(static fn (?string $cell): string => strtolower(trim((string) $cell)), str_getcsv($text, $delimiter));
                $headerLine = $lineNumber;

                $missing = array_diff(self::COLUMNS, $header);
                if ($missing !== []) {
                    $report->addError($lineNumber, __('finances/exchangeRate.errors.csv_missing_header', ['columns' => implode(', ', self::COLUMNS)]));

                    return $report;
                }

                continue;
            }

            $cells = str_getcsv($text, $delimiter);
            if (\count($cells) !== \count($header)) {
                $report->addError($lineNumber, __('finances/exchangeRate.errors.csv_column_count', ['expected' => \count($header), 'actual' => \count($cells)]));

                continue;
            }

            $rows[$lineNumber] = array_combine($header, array_map(static fn (?string $cell): string => trim((string) $cell), $cells));
        }

        $result = $this->ingest($rows, $sourceRef, $createdById);
        foreach ($report->errors as $error) {
            $result->addError($error['line'], $error['message']);
        }
        usort($result->errors, static fn (array $a, array $b): int => $a['line'] <=> $b['line']);

        return $result;
    }
}
